'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import clsx from 'clsx';

interface Message { role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  'Why is NAC in my stack?',
  'Can I take curcumin with my current meds?',
  'My afternoon energy is low, what can I do?',
  'Is my protein intake enough?',
  'What should I prioritize this week?',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${err instanceof Error ? err.message : 'Error. Try again.'}` }]);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto h-[calc(100dvh-8rem)] md:h-[calc(100dvh-5rem)] flex flex-col px-4 py-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-accent" />
        <h1 className="text-xl font-bold">Ask Your Protocol</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-accent/5 border border-accent/20">
              <p className="text-sm">
                <span className="text-accent font-semibold">👋 Hi!</span> I know your full profile, protocol, and biomarkers. Ask me anything specific.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-muted uppercase tracking-wider">Try asking:</p>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="w-full text-left px-3 py-2 rounded-xl bg-card border border-card-border hover:border-accent/30 transition-colors text-sm text-muted-foreground hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={clsx('max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap',
              m.role === 'user' ? 'bg-accent text-black rounded-br-sm' : 'bg-card border border-card-border rounded-bl-sm')}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-card border border-card-border flex gap-1">
              <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 pt-2 border-t border-card-border">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about your protocol..."
          className="flex-1 rounded-xl bg-card border border-card-border px-4 py-3 text-sm outline-none focus:border-accent" />
        <button type="submit" disabled={loading || !input.trim()}
          className="px-4 rounded-xl bg-accent text-black disabled:opacity-40 hover:bg-accent-dim transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
