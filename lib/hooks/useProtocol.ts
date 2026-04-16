'use client';

import { useState, useEffect } from 'react';
import { ProtocolOutput } from '../types';

interface ProtocolData {
  protocol: ProtocolOutput;
  longevityScore: number;
  biologicalAge: number;
}

export function useProtocol() {
  const [data, setData] = useState<ProtocolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/my-data')
      .then(r => r.json())
      .then(d => {
        if (d.protocol) {
          setData({
            protocol: d.protocol.protocol_json,
            longevityScore: d.protocol.longevity_score,
            biologicalAge: d.protocol.biological_age,
          });
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
