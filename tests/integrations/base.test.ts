import { describe, test, expect } from 'vitest';
import {
  stateCookieName, generateState, buildRedirectUrl,
} from '@/lib/integrations/base';

describe('stateCookieName', () => {
  test('is provider-scoped so two concurrent flows don\'t collide', () => {
    expect(stateCookieName('oura')).toBe('oura_oauth_state');
    expect(stateCookieName('fitbit')).toBe('fitbit_oauth_state');
    expect(stateCookieName('withings')).toBe('withings_oauth_state');
  });
});

describe('generateState', () => {
  test('returns 64-char hex (32 bytes of entropy)', () => {
    const s = generateState();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is unique across many calls (CSPRNG sanity)', () => {
    const samples = new Set<string>();
    for (let i = 0; i < 100; i++) samples.add(generateState());
    expect(samples.size).toBe(100);
  });
});

describe('buildRedirectUrl', () => {
  test('uses the provider-specific callback path by default', () => {
    const url = buildRedirectUrl('oura');
    expect(url).toMatch(/\/api\/integrations\/oura\/callback$/);
  });

  test('honors the OURA_REDIRECT_URL env override when set', () => {
    const original = process.env.OURA_REDIRECT_URL;
    process.env.OURA_REDIRECT_URL = 'https://staging.example.com/custom/oura';
    try {
      expect(buildRedirectUrl('oura')).toBe('https://staging.example.com/custom/oura');
    } finally {
      if (original === undefined) delete process.env.OURA_REDIRECT_URL;
      else process.env.OURA_REDIRECT_URL = original;
    }
  });
});
