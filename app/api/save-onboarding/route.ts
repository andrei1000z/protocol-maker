import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GeneratedProtocol, UserProfile } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { profile, protocol, config } = body as {
      profile: UserProfile;
      protocol: GeneratedProtocol | null;
      config: { tasks: { name: string; category: string }[]; supplements: string[] } | null;
    };

    // Save protocol (if provided)
    if (protocol) {
      const { error: protocolError } = await supabase.from('protocols').insert({
        user_id: user.id,
        macro_targets: protocol.macroTargets,
        daily_tasks: protocol.dailyTasks,
        supplements: protocol.supplements,
        tips: protocol.tips,
        warnings: protocol.warnings,
        summary: protocol.summary,
      });
      if (protocolError) {
        return NextResponse.json({ error: 'Failed to save protocol', details: protocolError.message }, { status: 500 });
      }
    }

    // Save profile
    if (profile) {
      const { error: profileError } = await supabase.from('profiles').update({
        name: profile.name,
        age: profile.age,
        sex: profile.sex,
        height: profile.height,
        weight: profile.weight,
        goals: profile.goals,
        fitness_level: profile.fitnessLevel,
        macro_targets: profile.macroTargets,
        onboarding_completed: profile.onboardingCompleted,
      }).eq('id', user.id);
      if (profileError) {
        return NextResponse.json({ error: 'Failed to save profile', details: profileError.message }, { status: 500 });
      }
    }

    // Save user config (if provided)
    if (config) {
      const { error: configError } = await supabase.from('user_configs').upsert({
        user_id: user.id,
        tasks: config.tasks,
        supplements: config.supplements,
      }, { onConflict: 'user_id' });
      if (configError) {
        return NextResponse.json({ error: 'Failed to save config', details: configError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
