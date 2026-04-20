// Each provider module exposes isConfigured() + buildAuthorizeUrl() as its
// safe, pure public surface. Actual token exchange / data fetch is network-
// bound and tested separately with a mock fetch.

import { describe, test, expect } from 'vitest';
import * as oura from '@/lib/integrations/oura';
import * as fitbit from '@/lib/integrations/fitbit';
import * as withings from '@/lib/integrations/withings';
import * as whoop from '@/lib/integrations/whoop';
import * as googleFit from '@/lib/integrations/google-fit';

describe('Oura provider module', () => {
  test('isConfigured returns false when env vars are missing', () => {
    const originalId = process.env.OURA_CLIENT_ID;
    const originalSecret = process.env.OURA_CLIENT_SECRET;
    delete process.env.OURA_CLIENT_ID;
    delete process.env.OURA_CLIENT_SECRET;
    try {
      expect(oura.isConfigured()).toBe(false);
    } finally {
      if (originalId !== undefined) process.env.OURA_CLIENT_ID = originalId;
      if (originalSecret !== undefined) process.env.OURA_CLIENT_SECRET = originalSecret;
    }
  });

  test('buildAuthorizeUrl embeds state + scopes', () => {
    const originalId = process.env.OURA_CLIENT_ID;
    process.env.OURA_CLIENT_ID = 'test-client';
    try {
      const url = oura.buildAuthorizeUrl('abc123');
      expect(url).toMatch(/cloud\.ouraring\.com/);
      expect(url).toMatch(/state=abc123/);
      expect(url).toMatch(/client_id=test-client/);
      expect(url).toMatch(/response_type=code/);
      for (const s of oura.OURA_SCOPES) {
        expect(url).toMatch(new RegExp(s));
      }
    } finally {
      if (originalId === undefined) delete process.env.OURA_CLIENT_ID;
      else process.env.OURA_CLIENT_ID = originalId;
    }
  });
});

describe('Fitbit provider module', () => {
  test('isConfigured reflects env presence', () => {
    const bothSet = !!process.env.FITBIT_CLIENT_ID && !!process.env.FITBIT_CLIENT_SECRET;
    expect(fitbit.isConfigured()).toBe(bothSet);
  });

  test('buildAuthorizeUrl includes expected scopes + state', () => {
    const originalId = process.env.FITBIT_CLIENT_ID;
    process.env.FITBIT_CLIENT_ID = 'fitbit-test';
    try {
      const url = fitbit.buildAuthorizeUrl('xyz');
      expect(url).toMatch(/fitbit\.com\/oauth2\/authorize/);
      expect(url).toMatch(/state=xyz/);
      expect(url).toMatch(/client_id=fitbit-test/);
      expect(url).toMatch(/activity/);
      expect(url).toMatch(/heartrate/);
      expect(url).toMatch(/sleep/);
    } finally {
      if (originalId === undefined) delete process.env.FITBIT_CLIENT_ID;
      else process.env.FITBIT_CLIENT_ID = originalId;
    }
  });
});

describe('Withings provider module', () => {
  test('scopes are comma-separated (not space) per Withings quirk', () => {
    const originalId = process.env.WITHINGS_CLIENT_ID;
    process.env.WITHINGS_CLIENT_ID = 'withings-test';
    try {
      const url = withings.buildAuthorizeUrl('state-xyz');
      expect(url).toMatch(/account\.withings\.com/);
      expect(url).toMatch(/state=state-xyz/);
      // Decode the scope param and verify commas (encoded as %2C)
      const u = new URL(url);
      const scope = u.searchParams.get('scope');
      expect(scope).toBeTruthy();
      expect(scope!.includes(',')).toBe(true);
      expect(scope!.split(',').length).toBeGreaterThanOrEqual(2);
    } finally {
      if (originalId === undefined) delete process.env.WITHINGS_CLIENT_ID;
      else process.env.WITHINGS_CLIENT_ID = originalId;
    }
  });
});

describe('WHOOP provider module', () => {
  test('authorize URL includes offline scope (required for refresh)', () => {
    const originalId = process.env.WHOOP_CLIENT_ID;
    process.env.WHOOP_CLIENT_ID = 'whoop-test';
    try {
      const url = whoop.buildAuthorizeUrl('whoop-state');
      expect(url).toMatch(/whoop\.com/);
      expect(url).toMatch(/client_id=whoop-test/);
      expect(url).toMatch(/state=whoop-state/);
      // offline is what gives us the refresh_token — must be in scopes.
      const u = new URL(url);
      const scope = u.searchParams.get('scope') || '';
      expect(scope.split(/[\s+]+/)).toContain('offline');
      expect(scope).toMatch(/read:recovery/);
      expect(scope).toMatch(/read:sleep/);
    } finally {
      if (originalId === undefined) delete process.env.WHOOP_CLIENT_ID;
      else process.env.WHOOP_CLIENT_ID = originalId;
    }
  });
});

describe('Google Fit provider module', () => {
  test('authorize URL requests offline access + consent for refresh-token delivery', () => {
    const originalId = process.env.GOOGLE_FIT_CLIENT_ID;
    process.env.GOOGLE_FIT_CLIENT_ID = 'gfit-test';
    try {
      const url = googleFit.buildAuthorizeUrl('gfit-state');
      expect(url).toMatch(/accounts\.google\.com/);
      expect(url).toMatch(/access_type=offline/);
      // prompt=consent ensures Google returns a refresh_token even on re-auth.
      expect(url).toMatch(/prompt=consent/);
      // Scope is a space-separated list of full URL scopes.
      const u = new URL(url);
      const scope = u.searchParams.get('scope') || '';
      expect(scope).toMatch(/fitness\.activity\.read/);
      expect(scope).toMatch(/fitness\.heart_rate\.read/);
      expect(scope).toMatch(/fitness\.sleep\.read/);
    } finally {
      if (originalId === undefined) delete process.env.GOOGLE_FIT_CLIENT_ID;
      else process.env.GOOGLE_FIT_CLIENT_ID = originalId;
    }
  });
});
