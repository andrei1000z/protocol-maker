import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, logAudit } from '@/lib/supabase/admin';
import { logger, describeError } from '@/lib/logger';

export const runtime = 'nodejs';

// F8 — Household / family mode
// ─────────────────────────────────────────────────────────────────────────────
// One owner can invite other accounts to share a household. Each member
// keeps their own profile + protocols + tracking (so partners and kids
// don't merge biomarkers); the owner can switch between them with a header
// dropdown (see HouseholdSwitcher component).
//
// Membership model:
//   - profiles.household_owner_id → owner's auth.users.id (NULL = solo)
//   - profiles.household_role     → 'owner' | 'member' | NULL
//   - Invite by email: we look up the auth user with that email, set their
//     household_owner_id = owner.id, household_role = 'member'. If the email
//     hasn't signed up yet, return a "user not found" error so the owner can
//     forward them a referral link instead.
//
// RLS still isolates rows by auth.uid() = id on profiles. The owner reading
// "list household members" goes through this route, which uses the admin
// client to bypass RLS and returns only the rows that belong to the owner's
// household. Cross-user data access via SQL stays blocked by the existing
// profile RLS policy.

const InviteSchema = z.object({
  email: z.string().email().max(254),
});

// GET /api/household — return the caller's household roster (owner + members).
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const admin = createAdminClient();
    const { data: myProfile } = await admin
      .from('profiles')
      .select('id, household_owner_id, household_role, onboarding_data')
      .eq('id', user.id)
      .maybeSingle();

    // Resolve which household to read. If I'm a member, use my owner. If I'm
    // an owner (or solo), use myself.
    const ownerId = (myProfile?.household_role === 'member' && myProfile.household_owner_id)
      ? myProfile.household_owner_id
      : user.id;

    const { data: members } = await admin
      .from('profiles')
      .select('id, onboarding_data, household_role, household_owner_id, created_at')
      .or(`id.eq.${ownerId},household_owner_id.eq.${ownerId}`);

    const summarize = (row: { id: string; onboarding_data: unknown; household_role: string | null; household_owner_id: string | null; created_at: string | null } | null) => {
      if (!row) return null;
      const od = (row.onboarding_data || {}) as Record<string, unknown>;
      const name = typeof od.name === 'string' && od.name.trim() ? od.name.trim() : null;
      return {
        id: row.id,
        name,
        role: row.id === ownerId ? 'owner' : (row.household_role || null),
        isYou: row.id === user.id,
        createdAt: row.created_at,
      };
    };

    return NextResponse.json({
      ownerId,
      role: myProfile?.household_role || (ownerId === user.id ? 'owner_or_solo' : 'member'),
      members: (members || []).map(summarize).filter(Boolean),
    });
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}

// POST /api/household — invite an existing user by email into my household.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const raw = await request.json().catch(() => null);
    const parsed = InviteSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    const targetEmail = parsed.data.email.toLowerCase();
    if (user.email && targetEmail === user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Nu te poți invita pe tine însuți.' }, { status: 400 });
    }

    const admin = createAdminClient();
    // Caller must be a household owner OR a solo account becoming an owner.
    const { data: caller } = await admin
      .from('profiles')
      .select('household_role, household_owner_id')
      .eq('id', user.id)
      .maybeSingle();
    if (caller?.household_role === 'member') {
      return NextResponse.json({ error: 'Doar proprietarul gospodăriei poate invita membri.' }, { status: 403 });
    }

    // Resolve target by email via auth admin listUsers — supabase-js doesn't
    // expose a direct getUserByEmail. Page size 200 is plenty for now; for
    // scale > 200 we'd switch to a server-side index lookup.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const target = list?.users.find(u => (u.email || '').toLowerCase() === targetEmail);
    if (!target) {
      return NextResponse.json({
        error: 'Utilizatorul nu există încă. Trimite-i link-ul tău de referință ca să-și facă cont, apoi reia invitația.',
      }, { status: 404 });
    }
    if (target.id === user.id) {
      return NextResponse.json({ error: 'Nu te poți invita pe tine însuți.' }, { status: 400 });
    }

    // Prevent stealing a member from another household. They must leave first.
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('household_owner_id, household_role')
      .eq('id', target.id)
      .maybeSingle();
    if (targetProfile?.household_owner_id && targetProfile.household_owner_id !== user.id) {
      return NextResponse.json({
        error: 'Persoana e deja membră în altă gospodărie. Trebuie să iasă de acolo înainte.',
      }, { status: 409 });
    }

    // Make myself an owner (idempotent) + add target as a member.
    await admin.from('profiles').update({
      household_owner_id: user.id,
      household_role: 'owner',
    }).eq('id', user.id);

    const { error } = await admin.from('profiles').update({
      household_owner_id: user.id,
      household_role: 'member',
    }).eq('id', target.id);
    if (error) {
      logger.error('household.invite_db_failed', { errorMessage: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAudit(admin, {
      actor: 'household',
      action: 'invite_member',
      targetUserId: target.id,
      metadata: { ownerId: user.id },
    });

    return NextResponse.json({ ok: true, memberId: target.id });
  } catch (err) {
    logger.error('household.invite_failed', { errorMessage: describeError(err) });
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}

// DELETE /api/household?memberId=… — remove a member from the household.
// Owner can remove anyone; a member can only remove themselves.
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const memberId = new URL(request.url).searchParams.get('memberId');
    if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

    const admin = createAdminClient();
    const { data: target } = await admin
      .from('profiles')
      .select('household_owner_id, household_role')
      .eq('id', memberId)
      .maybeSingle();

    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const isSelfLeaving = memberId === user.id;
    const isOwnerRemoving = target.household_owner_id === user.id;
    if (!isSelfLeaving && !isOwnerRemoving) {
      return NextResponse.json({ error: 'Nu ai drepturi să elimini acest membru.' }, { status: 403 });
    }

    const { error } = await admin.from('profiles').update({
      household_owner_id: null,
      household_role: null,
    }).eq('id', memberId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAudit(admin, {
      actor: 'household',
      action: 'remove_member',
      targetUserId: memberId,
      metadata: { initiatorId: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 500 });
  }
}
