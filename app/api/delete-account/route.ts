import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Deletes the caller's auth.users row. Every app table references auth.users
 * with ON DELETE CASCADE, so profiles + protocols + blood_tests + daily_metrics
 * + share_links + compliance_logs are wiped automatically.
 *
 * Requires user to be authenticated (session cookie). Uses the service-role
 * admin client for the auth.admin.deleteUser() call since the user can't
 * delete themselves via normal auth.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (!body.confirm) {
      return NextResponse.json({ error: 'Missing confirmation' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Explicit data wipe before auth deletion — CASCADE handles most,
    // but this is belt-and-suspenders in case of dangling rows.
    await Promise.allSettled([
      admin.from('compliance_logs').delete().eq('user_id', user.id),
      admin.from('daily_metrics').delete().eq('user_id', user.id),
      admin.from('share_links').delete().eq('user_id', user.id),
      admin.from('protocols').delete().eq('user_id', user.id),
      admin.from('blood_tests').delete().eq('user_id', user.id),
      admin.from('profiles').delete().eq('id', user.id),
    ]);

    // Delete the auth user itself (this also signs them out)
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return NextResponse.json({ error: `Auth delete failed: ${deleteError.message}` }, { status: 500 });
    }

    // Sign out the session from the request cookie too
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('delete-account error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
