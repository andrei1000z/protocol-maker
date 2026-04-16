'use client';

import { useState, useEffect } from 'react';

interface BloodTest {
  id: string;
  taken_at: string;
  lab_name?: string;
  biomarkers: { code: string; value: number; unit: string }[];
}

export function useBloodTests() {
  const [tests, setTests] = useState<BloodTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/my-data')
      .then(r => r.json())
      .then(d => { setTests(d.bloodTests || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { tests, loading };
}
