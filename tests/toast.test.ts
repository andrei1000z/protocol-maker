import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast, subscribeToasts } from '@/lib/toast';

// jsdom isn't installed for the Node-default test environment, so we
// stub the minimal window surface the toast bus depends on:
// EventTarget + CustomEvent. Using EventTarget native gives us add/
// removeEventListener + dispatchEvent for free.
describe('toast bus', () => {
  let received: unknown[] = [];

  beforeEach(() => {
    received = [];
    const target = new EventTarget();
    // CustomEvent is global in modern Node; if not, polyfill via Event.
    vi.stubGlobal('window', target);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('default tone + autoincrementing id', () => {
    const unsub = subscribeToasts(e => received.push(e));
    const id = toast({ title: 'Hello' });
    expect(id).toMatch(/^tst-/);
    expect(received.length).toBe(1);
    expect((received[0] as { tone?: string }).tone).toBe('default');
    unsub();
  });

  test('subscribe / unsubscribe lifecycle', () => {
    const unsub = subscribeToasts(e => received.push(e));
    toast({ title: 'A' });
    expect(received.length).toBe(1);
    unsub();
    toast({ title: 'B' });
    expect(received.length).toBe(1); // no further deliveries after unsubscribe
  });

  test('tone helpers', () => {
    const unsub = subscribeToasts(e => received.push(e));
    toast.success('ok');
    toast.warning('hmm');
    toast.error('nope');
    expect((received[0] as { tone: string }).tone).toBe('success');
    expect((received[1] as { tone: string }).tone).toBe('warning');
    expect((received[2] as { tone: string }).tone).toBe('error');
    unsub();
  });

  test('returns id even when no listener subscribed', () => {
    expect(toast({ title: 'Whatever' })).toMatch(/^tst-/);
  });

  test('passes description + action through', () => {
    const onAction = vi.fn();
    const unsub = subscribeToasts(e => received.push(e));
    toast({ title: 'X', description: 'Y', action: { label: 'Undo', onAction } });
    const evt = received[0] as { description: string; action: { label: string; onAction: () => void } };
    expect(evt.description).toBe('Y');
    evt.action.onAction();
    expect(onAction).toHaveBeenCalled();
    unsub();
  });

  test('toast.undoable wires an Anulează action that runs the handler', async () => {
    const unsub = subscribeToasts(e => received.push(e));
    const undo = vi.fn(() => Promise.resolve());
    toast.undoable('Masă salvată', undo, 'Omlet cu avocado');
    const evt = received[0] as { tone: string; action: { label: string; onAction: () => Promise<void> } };
    expect(evt.tone).toBe('success');
    expect(evt.action.label).toBe('Anulează');
    await evt.action.onAction();
    expect(undo).toHaveBeenCalled();
    // A confirmation "Anulat" toast should have fired after the undo ran.
    expect(received.length).toBe(2);
    expect((received[1] as { title: string }).title).toBe('Anulat');
    unsub();
  });

  test('toast.undoable surfaces errors when the undo handler throws', async () => {
    const unsub = subscribeToasts(e => received.push(e));
    const undo = vi.fn(() => { throw new Error('DELETE failed'); });
    toast.undoable('Saved', undo);
    const evt = received[0] as { action: { onAction: () => Promise<void> } };
    await evt.action.onAction();
    expect(received.length).toBe(2);
    expect((received[1] as { tone: string; title: string }).tone).toBe('error');
    expect((received[1] as { title: string }).title).toContain('anula');
    unsub();
  });
});
