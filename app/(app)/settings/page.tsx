'use client';

import { useEffect, useState } from 'react';
import { Share2, Download, RotateCcw, LogOut, Copy, Check, FileText, User, Heart, Edit2, Save } from 'lucide-react';
import clsx from 'clsx';

interface Profile {
  age?: number;
  sex?: string;
  height_cm?: number;
  weight_kg?: number;
  activity_level?: string;
  diet_type?: string;
  conditions?: string[];
  medications?: { name: string; dose: string; frequency: string }[];
  current_supplements?: string[];
  goals?: string[];
  time_budget_min?: number;
  monthly_budget_ron?: number;
  experimental_openness?: string;
  onboarding_data?: Record<string, unknown>;
}

interface BloodTest { id: string; taken_at: string; biomarkers: unknown[]; }

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bloodTests, setBloodTests] = useState<BloodTest[]>([]);
  const [protocolId, setProtocolId] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable fields
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [timeBudget, setTimeBudget] = useState('');

  useEffect(() => {
    fetch('/api/my-data').then(r => r.json()).then(d => {
      setProfile(d.profile);
      if (d.protocol) setProtocolId(d.protocol.id);
      setBloodTests(d.bloodTests || []);
      if (d.profile) {
        setWeight(String(d.profile.weight_kg ?? ''));
        setHeight(String(d.profile.height_cm ?? ''));
        setAge(String(d.profile.age ?? ''));
        setMonthlyBudget(String(d.profile.monthly_budget_ron ?? ''));
        setTimeBudget(String(d.profile.time_budget_min ?? ''));
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    const updated = {
      ...profile,
      age: parseInt(age) || profile.age,
      heightCm: parseFloat(height) || profile.height_cm,
      weightKg: parseFloat(weight) || profile.weight_kg,
      monthlyBudgetRon: parseInt(monthlyBudget) || profile.monthly_budget_ron,
      timeBudgetMin: parseInt(timeBudget) || profile.time_budget_min,
      // keep existing arrays/objects
      sex: profile.sex,
      activityLevel: profile.activity_level,
      dietType: profile.diet_type,
      conditions: profile.conditions,
      medications: profile.medications,
      currentSupplements: profile.current_supplements,
      goals: profile.goals,
      experimentalOpenness: profile.experimental_openness,
      onboardingData: profile.onboarding_data,
      onboardingCompleted: true,
      onboardingStep: 5,
    };
    const res = await fetch('/api/save-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
      // refresh
      const d = await fetch('/api/my-data').then(r => r.json());
      setProfile(d.profile);
    }
  };

  const handleShare = async () => {
    if (!protocolId) return;
    const res = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ protocolId }) });
    const { slug } = await res.json();
    setShareUrl(`${window.location.origin}/share/${slug}`);
  };

  const handleCopy = () => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleExport = async () => {
    const res = await fetch('/api/my-data');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };
  const handleLogout = async () => { await fetch('/api/logout', { method: 'POST' }); window.location.href = '/login'; };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  const bmi = profile?.weight_kg && profile?.height_cm ? ((profile.weight_kg as number) / ((profile.height_cm as number) / 100) ** 2).toFixed(1) : '-';
  const od = (profile?.onboarding_data || {}) as Record<string, unknown>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile editor */}
      {profile && (
        <div className="rounded-2xl bg-card border border-card-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><User className="w-4 h-4 text-accent" /><h2 className="text-sm font-semibold">Profile</h2></div>
            {editing ? (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded-lg bg-card border border-card-border text-muted-foreground">Cancel</button>
                <button onClick={handleSave} className="text-xs px-3 py-1.5 rounded-lg bg-accent text-black font-semibold flex items-center gap-1">
                  <Save className="w-3 h-3" /> Save
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 rounded-lg bg-card border border-card-border text-muted-foreground hover:text-accent flex items-center gap-1">
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
          {saved && <p className="text-xs text-accent">✓ Saved</p>}

          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] text-muted">Age</label><input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full mt-1 rounded-xl bg-background border border-card-border px-3 py-2 text-sm outline-none focus:border-accent font-mono" /></div>
              <div><label className="text-[10px] text-muted">Height (cm)</label><input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full mt-1 rounded-xl bg-background border border-card-border px-3 py-2 text-sm outline-none focus:border-accent font-mono" /></div>
              <div><label className="text-[10px] text-muted">Weight (kg)</label><input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="w-full mt-1 rounded-xl bg-background border border-card-border px-3 py-2 text-sm outline-none focus:border-accent font-mono" /></div>
              <div><label className="text-[10px] text-muted">Monthly budget (RON)</label><input type="number" value={monthlyBudget} onChange={e => setMonthlyBudget(e.target.value)} className="w-full mt-1 rounded-xl bg-background border border-card-border px-3 py-2 text-sm outline-none focus:border-accent font-mono" /></div>
              <div><label className="text-[10px] text-muted">Time budget (min/day)</label><input type="number" value={timeBudget} onChange={e => setTimeBudget(e.target.value)} className="w-full mt-1 rounded-xl bg-background border border-card-border px-3 py-2 text-sm outline-none focus:border-accent font-mono" /></div>
              <div className="col-span-2 p-3 rounded-xl bg-background/50 border border-card-border text-[10px] text-muted-foreground">
                For deeper changes (chronotype, pain points, goals, medications): use <span className="text-accent">Regenerate protocol</span> below to re-run onboarding.
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { label: 'Age', value: profile.age },
                  { label: 'Sex', value: profile.sex === 'male' ? 'M' : 'F' },
                  { label: 'BMI', value: bmi },
                  { label: 'Activity', value: profile.activity_level },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-xl bg-background border border-card-border">
                    <p className="text-lg font-bold font-mono">{String(item.value || '-')}</p>
                    <p className="text-[10px] text-muted">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3 rounded-xl bg-background border border-card-border">
                  <p className="text-sm font-bold font-mono">{profile.height_cm || '-'} cm</p>
                  <p className="text-[10px] text-muted">Height</p>
                </div>
                <div className="p-3 rounded-xl bg-background border border-card-border">
                  <p className="text-sm font-bold font-mono">{profile.weight_kg || '-'} kg</p>
                  <p className="text-[10px] text-muted">Weight</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-background border border-card-border">
                  <p className="text-[10px] text-muted">Diet</p>
                  <p className="text-sm font-medium capitalize">{profile.diet_type}</p>
                </div>
                <div className="p-3 rounded-xl bg-background border border-card-border">
                  <p className="text-[10px] text-muted">Budget</p>
                  <p className="text-sm font-medium">{profile.monthly_budget_ron} RON/mo · {profile.time_budget_min} min/day</p>
                </div>
              </div>
              {(profile.conditions as string[])?.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted mb-1">Conditions</p>
                  <div className="flex flex-wrap gap-1">{(profile.conditions as string[]).map((c, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-warning/20 text-warning">{c}</span>)}</div>
                </div>
              )}
              {(profile.medications as unknown[])?.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted mb-1">Medications</p>
                  <div className="space-y-1">
                    {(profile.medications as { name: string; dose: string; frequency: string }[]).filter(m => m.name).map((m, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {m.name} {m.dose} ({m.frequency})</p>
                    ))}
                  </div>
                </div>
              )}
              {od.chronotype && (
                <div>
                  <p className="text-[10px] text-muted mb-1">Chronotype</p>
                  <p className="text-xs capitalize">🕐 {String(od.chronotype)} person</p>
                </div>
              )}
              {od.painPoints && (
                <div>
                  <p className="text-[10px] text-muted mb-1">Pain Points</p>
                  <p className="text-xs text-muted-foreground">{String(od.painPoints)}</p>
                </div>
              )}
              {(od.familyHistory as string[])?.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted mb-1">Family History</p>
                  <div className="flex flex-wrap gap-1">{(od.familyHistory as string[]).map((c, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{c}</span>)}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-card border border-card-border p-5 space-y-3">
        <div className="flex items-center gap-2"><Heart className="w-4 h-4 text-accent" /><h2 className="text-sm font-semibold">Blood Test History</h2></div>
        {bloodTests.length === 0 ? <p className="text-xs text-muted-foreground">No blood tests uploaded yet.</p> : (
          <div className="space-y-2">{bloodTests.map((test, i) => (
            <div key={test.id || i} className="flex items-center gap-2 p-3 rounded-xl bg-background border border-card-border">
              <FileText className="w-4 h-4 text-muted" />
              <div><p className="text-sm font-medium">{new Date(test.taken_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                <p className="text-[10px] text-muted">{Array.isArray(test.biomarkers) ? test.biomarkers.length : 0} biomarkers</p></div>
            </div>
          ))}</div>
        )}
        <button onClick={async () => { await fetch('/api/reset-onboarding', { method: 'POST' }); window.location.href = '/onboarding'; }}
          className="text-xs text-accent hover:underline">+ Add new blood work (regenerates protocol)</button>
      </div>

      <div className="rounded-2xl bg-card border border-card-border p-5 space-y-3">
        <div className="flex items-center gap-2"><Share2 className="w-4 h-4 text-accent" /><h2 className="text-sm font-semibold">Share Protocol</h2></div>
        {!shareUrl ? (
          <button onClick={handleShare} disabled={!protocolId} className="w-full py-3 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm font-medium hover:bg-accent/20 transition-colors disabled:opacity-30">Generate public link</button>
        ) : (
          <div className="flex items-center gap-2">
            <input readOnly value={shareUrl} className="flex-1 rounded-xl bg-background border border-card-border px-3 py-2 text-xs font-mono" />
            <button onClick={handleCopy} className="p-2 rounded-xl bg-accent text-black">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-card border border-card-border p-5 space-y-1">
        <h2 className="text-sm font-semibold mb-3">Actions</h2>
        {[
          { icon: <RotateCcw className="w-4 h-4" />, label: 'Regenerate protocol', desc: 'Re-do onboarding', onClick: async () => { await fetch('/api/reset-onboarding', { method: 'POST' }); window.location.href = '/onboarding'; }, color: 'text-accent' },
          { icon: <Download className="w-4 h-4" />, label: 'Export all data', desc: 'JSON backup', onClick: handleExport, color: 'text-foreground' },
          { icon: <LogOut className="w-4 h-4" />, label: 'Log out', desc: '', onClick: handleLogout, color: 'text-danger' },
        ].map(a => (
          <button key={a.label} onClick={a.onClick} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-background transition-colors text-left">
            <span className={a.color}>{a.icon}</span>
            <div><p className={clsx('text-sm font-medium', a.color)}>{a.label}</p>{a.desc && <p className="text-[10px] text-muted">{a.desc}</p>}</div>
          </button>
        ))}
      </div>

      <p className="text-xs text-center text-muted">Protocol AI Engine v3.0 — Not medical advice</p>
    </div>
  );
}
