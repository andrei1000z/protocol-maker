// Tiny toast bus — global event-emitter pattern, no React context, no
// providers. `toast()` from anywhere fires an event; the <ToastViewport>
// component (mounted once at the layout root) listens and renders.
//
// This deliberately avoids react-hot-toast / sonner — those are great
// libraries but adding a runtime dep for what amounts to one component
// + four event types isn't worth the bundle bytes when the entire app
// can fit the implementation in 80 lines.

export type ToastTone = 'default' | 'success' | 'warning' | 'error';
export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss timeout in ms. 0 = sticky (user must close). Default 4000. */
  duration?: number;
  /** Optional action button — fires `onAction` then dismisses the toast. */
  action?: { label: string; onAction: () => void };
}

export interface ToastEvent extends ToastInput {
  id: string;
}

const EVENT_NAME = 'protocol:toast';

/** Fire a toast from anywhere. Server-side or non-DOM contexts are no-ops. */
export function toast(input: ToastInput): string {
  if (typeof window === 'undefined') return '';
  const id = 'tst-' + Math.random().toString(36).slice(2, 10);
  const payload: ToastEvent = { id, duration: 4000, tone: 'default', ...input };
  window.dispatchEvent(new CustomEvent<ToastEvent>(EVENT_NAME, { detail: payload }));
  return id;
}

// Convenience tone-prefixed helpers — same ergonomics as the popular libs.
toast.success = (title: string, description?: string) => toast({ title, description, tone: 'success' });
toast.warning = (title: string, description?: string) => toast({ title, description, tone: 'warning' });
toast.error   = (title: string, description?: string) => toast({ title, description, tone: 'error' });

/** Subscribe to toast events. Returns the unsubscribe function. The
 *  ToastViewport component uses this; app code should call `toast()` instead. */
export function subscribeToasts(handler: (evt: ToastEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onEvent = (e: Event) => {
    const detail = (e as CustomEvent<ToastEvent>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(EVENT_NAME, onEvent);
  return () => window.removeEventListener(EVENT_NAME, onEvent);
}
