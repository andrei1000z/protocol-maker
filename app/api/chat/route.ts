import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Groq from 'groq-sdk';
import { getChatRateLimit, checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 30;

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Rate limit: 30 messages per hour
    const { allowed, reset } = await checkRateLimit(getChatRateLimit(), user.id);
    if (!allowed) {
      const resetIn = reset ? Math.ceil((reset - Date.now()) / 60000) : 60;
      return NextResponse.json({ error: `Too many messages. Try again in ${resetIn}m.`, rateLimited: true }, { status: 429 });
    }

    const { messages } = await request.json() as { messages: ChatMessage[] };
    if (!messages || !Array.isArray(messages)) return NextResponse.json({ error: 'messages required' }, { status: 400 });

    // Load user context
    const [profileRes, protocolRes, bloodTestsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('protocols').select('protocol_json, longevity_score, biological_age, detected_patterns').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('blood_tests').select('biomarkers, taken_at').eq('user_id', user.id).order('taken_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const protocol = protocolRes.data;
    const bloodTest = bloodTestsRes.data;

    // Build context for the assistant
    const contextBlock = `
USER CONTEXT (for your reference only, never quote back raw):
- Age: ${profile?.age || '?'}, Sex: ${profile?.sex || '?'}, BMI: ${profile?.weight_kg && profile?.height_cm ? (profile.weight_kg / ((profile.height_cm / 100) ** 2)).toFixed(1) : '?'}
- Activity: ${profile?.activity_level || '?'}
- Diet: ${profile?.diet_type || '?'}
- Sleep: ${profile?.sleep_hours_avg || '?'}h quality ${profile?.sleep_quality || '?'}/10
- Conditions: ${(profile?.conditions || []).join(', ') || 'None'}
- Medications: ${JSON.stringify(profile?.medications || [])}
- Current supplements: ${(profile?.current_supplements || []).join(', ') || 'None'}
- Goals: ${JSON.stringify(profile?.goals || [])}
- Monthly budget: ${profile?.monthly_budget_ron || '?'} RON

${protocol ? `PROTOCOL SUMMARY:
- Longevity Score: ${protocol.longevity_score}/100
- Biological Age: ${protocol.biological_age} (chronological: ${profile?.age})
- Detected Patterns: ${JSON.stringify((protocol.detected_patterns as { name: string }[] | null)?.map(p => p.name) || [])}
- Protocol supplements: ${JSON.stringify((protocol.protocol_json as { supplements?: { name: string; dose: string }[] })?.supplements?.map(s => `${s.name} ${s.dose}`).slice(0, 10) || [])}` : 'No protocol generated yet.'}

${bloodTest ? `LATEST BLOOD WORK (${bloodTest.taken_at}):
${JSON.stringify(bloodTest.biomarkers)}` : 'No blood work uploaded.'}`;

    const systemPrompt = `You are the patient's personal longevity coach. You have access to their full profile, protocol, and biomarkers below. Answer their questions specifically — reference their actual values when relevant.

RULES:
1. Never prescribe medications — always say "discuss with your doctor because [reason]"
2. Check drug-supplement interactions if they ask about adding something new
3. If they ask about symptoms that could be serious, recommend they see a doctor
4. Keep answers concise — 2-4 sentences for simple questions, longer only when needed
5. Use their actual data, not generic advice
6. If they ask something outside your scope, say so politely

${contextBlock}

Be friendly, evidence-based, and specific. No medical advice disclaimers on every message — just be helpful.`;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const reply = completion.choices[0]?.message?.content || '';
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
