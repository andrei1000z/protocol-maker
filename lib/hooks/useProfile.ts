'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    fetch('/api/my-data')
      .then((r) => r.json())
      .then((data) => {
        setProfile(data.profile);
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
  }, []);

  const saveProfile = useCallback(async (p: UserProfile) => {
    setProfile(p);
    await fetch('/api/save-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: p, protocol: null, config: null }),
    });
  }, []);

  return { profile, saveProfile, hydrated };
}
