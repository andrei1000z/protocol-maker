'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMyData, useStatistics, invalidate } from '@/lib/hooks/useApiData';
import { Send, Sparkles, Trash2, Brain, Check, X, Activity, FileEdit, ClipboardList } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';

interface Message { role: 'user' | 'assistant'; content: string; }

// Inline AI-emitted action — chip the user can apply or skip.
// Format in stream: [[ACTION:type {json}]] on its own line.
interface ChatAction {
  id: string;
  type: 'update_profile' | 'log_metric' | 'adjust_protocol';
  payload: Record<string, unknown>;
  status: 'pending' | 'applying' | 'applied' | 'skipped' | 'error';
  error?: string;
}

const ACTION_REGEX = /\[\[ACTION:(update_profile|log_metric|adjust_protocol)\s+(\{[\s\S]*?\})\]\]/g;

// Pull actions out of an assistant message; return clean text + parsed actions.
// Stable IDs keep React state in sync across re-parses while streaming.
function parseActions(raw: string, msgIndex: number): { clean: string; actions: ChatAction[] } {
  const actions: ChatAction[] = [];
  let actionIdx = 0;
  const clean = raw.replace(ACTION_REGEX, (_, type, json) => {
    try {
      const payload = JSON.parse(json);
      actions.push({
        id: `${msgIndex}-${actionIdx++}`,
        type: type as ChatAction['type'],
        payload,
        status: 'pending',
      });
    } catch {
      // Malformed JSON — skip silently, keep the marker hidden in clean text
    }
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { clean, actions };
}

interface UserContext {
  hasProtocol: boolean;
  bloodTests: number;
  metricsDays: number;
  longevityScore: number | null;
  name: string | null;
}

// Contextual suggestions — short, direct, the way people actually ask.
function buildSuggestions(ctx: UserContext | null): string[] {
  const defaults = [
    'How am I doing?',
    'What should I fix first?',
    'Which supplement matters most?',
    'My energy is low — why?',
    'What would Bryan Johnson change?',
  ];
  if (!ctx) return defaults;
  const prompts: string[] = [];
  if (ctx.hasProtocol) prompts.push('Give me a 30-second read.');
  if (ctx.hasProtocol) prompts.push('One thing to focus on this week?');
  if (ctx.metricsDays >= 3) prompts.push('Anything red in my last few days?');
  if (ctx.bloodTests > 0) prompts.push('Explain my worst biomarker in plain words.');
  if (ctx.bloodTests === 0) prompts.push('Which labs should I order first?');
  prompts.push('Am I taking anything I don\'t need?');
  prompts.push('How do I improve my HRV?');
  prompts.push('What\'s blocking my biological age?');
  return prompts.slice(0, 6);
}

// ─────────────────────────────────────────────────────────────────────────────
// Action chip — one tap-to-apply card per AI-suggested action.
// ─────────────────────────────────────────────────────────────────────────────
function ActionChip({ action, onApply, onSkip }: {
  action: ChatAction;
  onApply: (a: ChatAction) => void;
  onSkip: (a: ChatAction) => void;
}) {
  const meta = action.type === 'update_profile'
    ? { icon: FileEdit, label: 'Update profile', color: 'text-accent' }
    : action.type === 'log_metric'
    ? { icon: Activity, label: 'Log metric', color: 'text-blue-400' }
    : { icon: ClipboardList, label: 'Adjust protocol', color: 'text-amber-400' };
  const Icon = meta.icon;

  // Pretty payload preview — keep it readable, not raw JSON
  const preview = (() => {
    if (action.type === 'log_metric') {
      const { date, ...rest } = action.payload as Record<string, unknown>;
      const fields = Object.entries(rest).map(([k, v]) => `${k}: ${v}`).join(' · ');
      return `${date} → ${fields}`;
    }
    if (action.type === 'adjust_protocol') {
      return `${action.payload.path} = ${JSON.stringify(action.payload.value)}`;
    }
    if (action.payload.onboarding_data_patch) {
      const op = action.payload.onboarding_data_patch as Record<string, unknown>;
      return Object.entries(op).map(([k, v]) => `${k}: ${v}`).join(' · ');
    }
    return Object.entries(action.payload).map(([k, v]) => `${k}: ${v}`).join(' · ');
  })();

  if (action.status === 'applied') {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-accent/[0.06] border border-accent/20">
        <Check className="w-3.5 h-3.5 text-accent shrink-0" />
        <span className="text-[11px] text-accent font-medium">{meta.label} applied</span>
        <span className="text-[11px] text-muted truncate flex-1">— {preview}</span>
      </div>
    );
  }
  if (action.status === 'skipped') {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 border border-card-border opacity-50">
        <X className="w-3.5 h-3.5 text-muted shrink-0" />
        <span className="text-[11px] text-muted">Skipped: {meta.label.toLowerCase()}</span>
      </div>
    );
  }
  if (action.status === 'error') {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/[0.06] border border-red-500/20">
        <X className="w-3.5 h-3.5 text-danger shrink-0" />
        <span className="text-[11px] text-danger">Error: {action.error}</span>
        <button onClick={() => onApply(action)} className="text-[11px] text-accent hover:underline ml-auto">Retry</button>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-accent/[0.04] border border-accent/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={clsx('w-3.5 h-3.5 shrink-0', meta.color)} />
        <span className={clsx('text-xs font-semibold uppercase tracking-widest', meta.color)}>{meta.label}</span>
      </div>
      <p className="text-[12px] text-foreground/90 leading-snug font-mono break-all">{preview}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onApply(action)}
          disabled={action.status === 'applying'}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-black text-[11px] font-semibold hover:bg-accent-bright disabled:opacity-50 transition-all"
        >
          {action.status === 'applying' ? (
            <>
              <span className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin" />
              Applying…
            </>
          ) : (
            <>
              <Check className="w-3 h-3" />
              Apply
            </>
          )}
        </button>
        <button
          onClick={() => onSkip(action)}
          disabled={action.status === 'applying'}
          className="px-3 py-1.5 rounded-lg bg-surface-2 border border-card-border text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown rendering — tight, themed, links open in new tab
// ─────────────────────────────────────────────────────────────────────────────
function AssistantContent({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-invert max-w-none
                    prose-p:my-2 prose-p:leading-relaxed prose-p:text-foreground/95
                    prose-strong:text-accent prose-strong:font-semibold
                    prose-em:text-foreground/90
                    prose-code:bg-surface-3 prose-code:text-accent prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none
                    prose-ul:my-2 prose-ul:pl-5 prose-ol:my-2 prose-ol:pl-5
                    prose-li:my-0.5 prose-li:leading-relaxed
                    prose-h1:text-base prose-h1:font-semibold prose-h1:mt-3 prose-h1:mb-2
                    prose-h2:text-sm prose-h2:font-semibold prose-h2:mt-3 prose-h2:mb-1.5
                    prose-h3:text-sm prose-h3:font-medium prose-h3:mt-2 prose-h3:mb-1
                    prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                    prose-blockquote:border-accent/40 prose-blockquote:text-muted-foreground prose-blockquote:italic">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-sizing textarea hook
// ─────────────────────────────────────────────────────────────────────────────
function useAutoResize(value: string, maxHeight = 180) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);
  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'protocol:chat:messages:v1';

// Sentinel prefix so the UI can distinguish "AI reply" from "stream error"
// and show a retry affordance. Real Claude replies never start with this.
const CHAT_ERROR_PREFIX = '__CHAT_ERR__:';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  // Map of msgIndex -> array of action states. Decoupled from message text so
  // user-action statuses (applied/skipped/error) survive re-renders + scrolls.
  const [actionStates, setActionStates] = useState<Record<number, ChatAction[]>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useAutoResize(input);

  // Apply / skip handlers — POST to /api/chat-action, then mutate SWR caches
  const applyAction = useCallback(async (msgIdx: number, actionId: string) => {
    setActionStates(s => ({
      ...s,
      [msgIdx]: (s[msgIdx] || []).map(a => a.id === actionId ? { ...a, status: 'applying' as const, error: undefined } : a),
    }));
    const action = (actionStates[msgIdx] || []).find(a => a.id === actionId);
    if (!action) return;
    try {
      const res = await fetch('/api/chat-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: action.type, payload: action.payload }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed (${res.status})`);
      }
      setActionStates(s => ({
        ...s,
        [msgIdx]: (s[msgIdx] || []).map(a => a.id === actionId ? { ...a, status: 'applied' as const } : a),
      }));
      // Refresh whichever data store the action touched
      if (action.type === 'update_profile' || action.type === 'adjust_protocol') invalidate.myData();
      if (action.type === 'log_metric') { invalidate.statistics(); invalidate.dailyMetrics(); }
    } catch (err) {
      setActionStates(s => ({
        ...s,
        [msgIdx]: (s[msgIdx] || []).map(a => a.id === actionId ? { ...a, status: 'error' as const, error: err instanceof Error ? err.message : 'Failed' } : a),
      }));
    }
  }, [actionStates]);

  const skipAction = useCallback((msgIdx: number, actionId: string) => {
    setActionStates(s => ({
      ...s,
      [msgIdx]: (s[msgIdx] || []).map(a => a.id === actionId ? { ...a, status: 'skipped' as const } : a),
    }));
  }, []);

  // SWR-cached context — shared with every other page, no extra fetch on navigation
  const { data: myData } = useMyData();
  const { data: stats } = useStatistics();
  const ctx: UserContext | null = myData ? (() => {
    const od = (myData.profile?.onboarding_data || {}) as Record<string, unknown>;
    return {
      hasProtocol: !!myData.protocol,
      bloodTests: (myData.bloodTests || []).length,
      metricsDays: (stats?.metrics || []).length,
      longevityScore: myData.protocol?.longevity_score ?? null,
      name: (typeof od.name === 'string' && od.name.trim()) ? od.name.trim() : null,
    };
  })() : null;

  // Load persisted conversation. Server-side chat_messages is the source of
  // truth when the table exists; localStorage is a fallback for the pre-
  // migration window + offline / first-paint speed (renders instantly while
  // the network call completes in the background).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setMessages(JSON.parse(stored));
    } catch { /* ignore */ }

    // Fetch server history. If it's non-empty and newer than whatever
    // localStorage had, replace — last writer wins so multi-device stays in sync.
    (async () => {
      try {
        const res = await fetch('/api/chat');
        if (!res.ok) return;
        const j = await res.json() as { messages?: Array<{ role: 'user' | 'assistant'; content: string; created_at: string }> };
        if (!Array.isArray(j.messages) || j.messages.length === 0) return;
        const srv: Message[] = j.messages.map(m => ({ role: m.role, content: m.content }));
        setMessages(srv);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(srv)); } catch { /* ignore */ }
      } catch { /* network — stay on localStorage copy */ }
    })();
  }, []);

  // Persist on change — localStorage only; server persistence happens inside
  // the /api/chat POST after each streamed reply lands.
  useEffect(() => {
    try {
      if (messages.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, [messages]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Deep-link entry: `/chat?q=...` auto-submits the question on first paint.
  // Used by the dashboard's floating "Ask AI" pill so a user can jump from
  // a dashboard section straight into a seeded conversation. Only fires
  // once on mount — subsequent renders shouldn't re-submit.
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (autoSubmittedRef.current) return;
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('q');
    if (!q || !q.trim()) return;
    autoSubmittedRef.current = true;
    // Clean the URL so a refresh doesn't re-auto-submit.
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    window.history.replaceState({}, '', url.toString());
    // Give the SWR context a beat to hydrate (the server prompt uses it),
    // then fire. Matches the delay humans wouldn't notice.
    const t = setTimeout(() => send(q), 150);
    return () => clearTimeout(t);
    // `send` is stable via useCallback on [messages, streaming]; re-running
    // this effect on its change would double-fire, so we intentionally lock
    // with the ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (text: string) => {
    const body = text.trim();
    if (!body || streaming) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: body }];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    // Append placeholder assistant message that we'll stream into
    setMessages(curr => [...curr, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, stream: true }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setMessages(curr => {
          const withoutPlaceholder = curr.slice(0, -1);
          return [...withoutPlaceholder, { role: 'assistant', content: `${CHAT_ERROR_PREFIX}${err.error || 'Chat failed'}` }];
        });
        return;
      }

      // Stream the response directly into the last assistant message
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages(curr => {
            const copy = [...curr];
            copy[copy.length - 1] = { role: 'assistant', content: acc };
            return copy;
          });
        }
      }
    } catch (err) {
      setMessages(curr => {
        const withoutPlaceholder = curr.slice(0, -1);
        return [...withoutPlaceholder, { role: 'assistant', content: `${CHAT_ERROR_PREFIX}${err instanceof Error ? err.message : 'Network error. Try again.'}` }];
      });
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming]);

  // Retry the last user message after an error: drop both the error reply
  // AND the user message, then resend. Preserves conversation order.
  const retryLast = useCallback(() => {
    if (streaming) return;
    setMessages(curr => {
      // Find the last user message followed by an error — drop the error,
      // re-send the user message via send()
      if (curr.length < 2) return curr;
      const lastIdx = curr.length - 1;
      const lastMsg = curr[lastIdx];
      if (lastMsg.role !== 'assistant' || !lastMsg.content.startsWith(CHAT_ERROR_PREFIX)) return curr;
      const priorUser = curr[lastIdx - 1];
      if (priorUser?.role !== 'user') return curr;
      // Drop both, then re-send. send() will re-append them.
      setTimeout(() => send(priorUser.content), 0);
      return curr.slice(0, lastIdx - 1);
    });
  }, [streaming, send]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    // Fire-and-forget server clear — matches what the user expects when they
    // hit Clear, keeps history consistent across devices.
    fetch('/api/chat', { method: 'DELETE' }).catch(() => { /* ignore */ });
  };

  const suggestions = buildSuggestions(ctx);
  const greeting = ctx?.name ? `Hey ${ctx.name}` : 'Hey there';

  const contextChips = [
    ctx?.hasProtocol ? { label: 'Protocol', tone: 'accent' as const } : null,
    ctx?.bloodTests && ctx.bloodTests > 0 ? { label: `${ctx.bloodTests} blood test${ctx.bloodTests === 1 ? '' : 's'}`, tone: 'neutral' as const } : null,
    ctx?.metricsDays && ctx.metricsDays > 0 ? { label: `${ctx.metricsDays} days tracked`, tone: 'neutral' as const } : null,
    ctx?.longevityScore !== null && ctx?.longevityScore !== undefined ? { label: `Score ${ctx.longevityScore}/100`, tone: 'accent' as const } : null,
  ].filter(Boolean) as { label: string; tone: 'accent' | 'neutral' }[];

  return (
    <div className="max-w-3xl mx-auto h-[calc(100dvh-4.5rem)] sm:h-[calc(100dvh-5rem)] flex flex-col px-4 sm:px-6 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 mb-3 border-b border-card-border shrink-0 animate-fade-in">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Longevity AI</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ctx === null
                ? 'Loading your context…'
                : ctx.hasProtocol
                  ? 'Has your full protocol, biomarkers, and tracking data loaded.'
                  : 'Complete onboarding to unlock personalized answers.'}
            </p>
            {contextChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {contextChips.map(c => (
                  <span
                    key={c.label}
                    className={clsx('text-xs font-medium px-2 py-0.5 rounded-full border',
                      c.tone === 'accent' ? 'bg-accent/10 text-accent border-accent/25' : 'bg-surface-2 text-muted-foreground border-card-border'
                    )}
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearConversation}
            disabled={streaming}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-surface-2 border border-card-border text-muted-foreground hover:text-danger hover:border-red-500/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
        {messages.length === 0 && (
          <div className="space-y-5 animate-fade-in-up">
            <div className="glass-card rounded-2xl p-5 sm:p-6">
              <p className="text-sm leading-relaxed">
                <span className="text-accent font-semibold">{greeting}.</span>{' '}
                I&apos;ve read your protocol, biomarkers, and last 2 weeks of tracking. Ask me anything — from &ldquo;why am I on NAC&rdquo; to &ldquo;is my morning BP worrying&rdquo; to &ldquo;what&apos;s my highest-leverage move this week&rdquo;.
              </p>
              <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                I cite your actual numbers. I flag symptoms that need a doctor. I don&apos;t prescribe Rx meds. I remember this conversation until you clear it.
              </p>
            </div>

            <div>
              <p className="text-xs text-muted uppercase tracking-widest mb-2.5 px-1">Try asking</p>
              <div className="space-y-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left px-4 py-3 rounded-xl bg-surface-2 border border-card-border hover:border-accent/35 hover:bg-surface-3 active:scale-[0.995] transition-all text-sm text-foreground/90 flex items-center gap-3 group"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-muted group-hover:text-accent shrink-0 transition-colors" />
                    <span className="flex-1">{s}</span>
                    <span className="text-muted group-hover:text-accent transition-colors">→</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          // For assistant messages, strip action markers from text + parse actions on the fly.
          // We persist the parsed actions into state on first parse so user statuses survive.
          let cleanText = m.content;
          let derivedActions: ChatAction[] = [];
          const isErrorReply = m.role === 'assistant' && m.content.startsWith(CHAT_ERROR_PREFIX);
          const errorMessage = isErrorReply ? m.content.slice(CHAT_ERROR_PREFIX.length) : '';
          if (m.role === 'assistant' && m.content && !isErrorReply) {
            const { clean, actions: parsed } = parseActions(m.content, i);
            cleanText = clean;
            // Merge: keep statuses/errors from existing state when IDs match
            const existing = actionStates[i] || [];
            derivedActions = parsed.map(p => existing.find(e => e.id === p.id) ?? p);
          }
          // Lazy-init action state for this message once it's stable (no longer streaming)
          if (m.role === 'assistant' && !streaming && derivedActions.length > 0 && !actionStates[i]) {
            // Defer to next tick to avoid setState during render
            setTimeout(() => setActionStates(s => s[i] ? s : ({ ...s, [i]: derivedActions })), 0);
          }
          return (
            <div key={i} className={clsx('flex animate-fade-in-up', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'user' ? (
                <div className="max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-md bg-accent text-black text-sm whitespace-pre-wrap break-words font-medium shadow-sm">
                  {m.content}
                </div>
              ) : (
                <div className="max-w-[92%] sm:max-w-[85%] w-full space-y-2">
                  <div className="flex items-center gap-2 mb-1.5 pl-1">
                    <div className="w-5 h-5 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
                      <Brain className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-xs text-muted font-medium uppercase tracking-widest">Protocol AI</span>
                  </div>
                  {isErrorReply ? (
                    <div className="glass-card rounded-2xl rounded-tl-md px-4 py-3 bg-red-500/[0.04] border border-red-500/20">
                      <div className="flex items-start gap-3">
                        <span className="text-xl leading-none mt-0.5">⚠️</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-danger">{errorMessage || 'Something went wrong'}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">Your message was kept — retry to resend it.</p>
                          <button
                            onClick={retryLast}
                            disabled={streaming}
                            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-black text-xs font-semibold hover:bg-accent-bright disabled:opacity-50 transition-all"
                          >
                            ↻ Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={clsx('glass-card rounded-2xl rounded-tl-md px-4 py-3',
                      m.content === '' && streaming && 'animate-pulse')}>
                      {m.content ? (
                        <AssistantContent text={cleanText} />
                      ) : (
                        <div className="flex gap-1.5 py-2">
                          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      )}
                    </div>
                  )}
                  {/* Action chips — appear AFTER streaming finishes for this message */}
                  {!streaming && derivedActions.length > 0 && (
                    <div className="space-y-1.5 pl-1">
                      <p className="text-xs text-muted uppercase tracking-widest">Tap to apply</p>
                      {derivedActions.map(a => (
                        <ActionChip
                          key={a.id}
                          action={a}
                          onApply={() => applyAction(i, a.id)}
                          onSkip={() => skipAction(i, a.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-end gap-2 pt-3 mt-3 border-t border-card-border shrink-0"
      >
        <div className="flex-1 rounded-2xl bg-surface-2 border border-card-border focus-within:border-accent/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={ctx?.hasProtocol ? 'Ask anything — labs, sleep, supplements, food…' : 'Finish onboarding so I can give you real answers'}
            className="w-full bg-transparent px-4 py-3 text-sm outline-none resize-none placeholder:text-muted-foreground/60 font-normal leading-relaxed max-h-[180px]"
            disabled={streaming}
          />
        </div>
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className={clsx('shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all',
            streaming || !input.trim()
              ? 'bg-surface-3 text-muted cursor-not-allowed'
              : 'bg-accent text-black hover:bg-accent-bright active:scale-95 glow-cta')}
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <p className="text-xs text-center text-muted pt-2 shrink-0">
        Shift + Enter for a new line · Not medical advice
      </p>
    </div>
  );
}
