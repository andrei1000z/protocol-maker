'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Trash2, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';

interface Message { role: 'user' | 'assistant'; content: string; }

interface UserContext {
  hasProtocol: boolean;
  bloodTests: number;
  metricsDays: number;
  longevityScore: number | null;
  name: string | null;
}

// Contextual suggestions based on what the user actually has
function buildSuggestions(ctx: UserContext | null): string[] {
  const defaults = [
    'How am I doing overall?',
    'What\'s my biggest risk right now?',
    'Which supplement matters most this week?',
    'My energy is low lately — what can I change?',
    'Am I on track vs Bryan Johnson?',
  ];
  if (!ctx) return defaults;
  const prompts: string[] = [];
  if (ctx.hasProtocol) prompts.push('Give me a 30-second status update.');
  if (ctx.hasProtocol) prompts.push('What should I focus on this week?');
  if (ctx.metricsDays >= 3) prompts.push('Look at my tracked data — any red flags?');
  if (ctx.bloodTests > 0) prompts.push('Explain my weakest biomarker in plain English.');
  if (ctx.bloodTests === 0) prompts.push('Which blood panel should I order first?');
  prompts.push('Are any of my supplements redundant?');
  prompts.push('How do I improve my HRV?');
  prompts.push('What\'s the #1 thing holding back my bio age?');
  return prompts.slice(0, 6);
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useAutoResize(input);

  // Load persisted conversation
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setMessages(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      if (messages.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, [messages]);

  // Load user context for header + suggestions
  useEffect(() => {
    fetch('/api/my-data').then(r => r.json()).then(d => {
      const od = d.profile?.onboarding_data || {};
      setCtx({
        hasProtocol: !!d.protocol,
        bloodTests: (d.bloodTests || []).length,
        metricsDays: 0, // filled by separate fetch below
        longevityScore: d.protocol?.longevity_score ?? null,
        name: (typeof od.name === 'string' && od.name.trim()) ? od.name.trim() : null,
      });
    }).catch(() => {});

    fetch('/api/statistics').then(r => r.json()).then(d => {
      setCtx(prev => prev ? { ...prev, metricsDays: (d.metrics || []).length } : prev);
    }).catch(() => {});
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

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
          return [...withoutPlaceholder, { role: 'assistant', content: `⚠️ ${err.error || 'Chat failed'}` }];
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
        return [...withoutPlaceholder, { role: 'assistant', content: `⚠️ ${err instanceof Error ? err.message : 'Error. Try again.'}` }];
      });
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
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
                    className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full border',
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
              <p className="text-[10px] text-muted uppercase tracking-widest mb-2.5 px-1">Try asking</p>
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

        {messages.map((m, i) => (
          <div key={i} className={clsx('flex animate-fade-in-up', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'user' ? (
              <div className="max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-md bg-accent text-black text-sm whitespace-pre-wrap break-words font-medium shadow-sm">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[92%] sm:max-w-[85%] w-full">
                <div className="flex items-center gap-2 mb-1.5 pl-1">
                  <div className="w-5 h-5 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <Brain className="w-3 h-3 text-accent" />
                  </div>
                  <span className="text-[10px] text-muted font-medium uppercase tracking-widest">Protocol AI</span>
                </div>
                <div className={clsx('glass-card rounded-2xl rounded-tl-md px-4 py-3',
                  m.content === '' && streaming && 'animate-pulse')}>
                  {m.content ? (
                    <AssistantContent text={m.content} />
                  ) : (
                    <div className="flex gap-1.5 py-2">
                      <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
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
            placeholder={ctx?.hasProtocol ? 'Ask about your protocol, biomarkers, habits…' : 'Finish onboarding to get specific answers'}
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

      <p className="text-[10px] text-center text-muted pt-2 shrink-0">
        Shift + Enter for a new line · Not medical advice
      </p>
    </div>
  );
}
