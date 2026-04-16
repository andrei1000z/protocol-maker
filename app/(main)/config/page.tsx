'use client';

import { useEffect, useState } from 'react';
import { UserProfile } from '@/lib/types';
import { ProfileForm } from '@/components/config/ProfileForm';
import { TaskManager } from '@/components/config/TaskManager';
import { SupplementEncyclopedia } from '@/components/config/SupplementEncyclopedia';
import { DataActions } from '@/components/config/DataActions';

export default function ConfigPage() {
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

  const saveProfile = async (p: UserProfile) => {
    setProfile(p);
    await fetch('/api/save-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: { ...p, onboardingCompleted: true }, protocol: null, config: null }),
    });
  };

  if (!hydrated || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Configurări</h1>
      <ProfileForm profile={profile} onSave={saveProfile} />
      <TaskManager />
      <SupplementEncyclopedia />
      <DataActions />
    </div>
  );
}
