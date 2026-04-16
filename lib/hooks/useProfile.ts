'use client';

import { useState, useEffect } from 'react';

export function useProfile() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/my-data')
      .then(r => r.json())
      .then(d => { setProfile(d.profile); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { profile, loading };
}
