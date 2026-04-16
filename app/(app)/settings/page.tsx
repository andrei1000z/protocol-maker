'use client';

import { useEffect, useState } from 'react';
import { Share2, Download, RotateCcw, LogOut, Copy, Check, ExternalLink } from 'lucide-react';

export default function SettingsPage() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [protocolId, setProtocolId] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/my-data').then((r) => r.json()).then((d) => {
      setProfile(d.profile);
      if (d.protocol) setProtocolId(d.protocol.id);
      setLoading(false);
    });
  }, []);

  const handleShare = async () => {
    if (!protocolId) return;
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ protocolId }),
    });
    const { slug } = await res.json();
    const url = `${window.location.origin}/share/${slug}`;
    setShareUrl(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const handleRegen = () => {
    window.location.href = '/onboarding';
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-dvh">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const bmi = profile?.weight_kg && profile?.height_cm
    ? ((profile.weight_kg as number) / ((profile.height_cm as number) / 100) ** 2).toFixed(1)
    : '-';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile summary */}
      {profile && (
        <div className="rounded-2xl bg-card border border-card-border p-5 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">👤 Profile</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { label: 'Age', value: profile.age },
              { label: 'Sex', value: profile.sex === 'male' ? 'M' : 'F' },
              { label: 'BMI', value: bmi },
              { label: 'Activity', value: profile.activity_level },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl bg-background border border-card-border">
                <p className="text-lg font-bold font-mono">{String(item.value || '-')}</p>
                <p className="text-[10px] text-muted">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share */}
      <div className="rounded-2xl bg-card border border-card-border p-5 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Share2 className="w-4 h-4 text-accent" /> Share</h2>
        {!shareUrl ? (
          <button onClick={handleShare} disabled={!protocolId}
            className="w-full py-3 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm font-medium hover:bg-accent/20 transition-colors disabled:opacity-30">
            Generate public link
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input readOnly value={shareUrl} className="flex-1 rounded-xl bg-background border border-card-border px-3 py-2 text-xs font-mono" />
            <button onClick={handleCopy} className="p-2 rounded-xl bg-accent text-black">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="rounded-2xl bg-card border border-card-border p-5 space-y-2">
        <h2 className="text-sm font-semibold mb-3">Actions</h2>
        {[
          { icon: <RotateCcw className="w-4 h-4" />, label: 'Regenerate protocol', desc: 'Re-do onboarding from scratch', onClick: handleRegen, color: 'text-accent' },
          { icon: <Download className="w-4 h-4" />, label: 'Export JSON data', desc: 'Complete data backup', onClick: handleExport, color: 'text-foreground' },
          { icon: <LogOut className="w-4 h-4" />, label: 'Log out', desc: '', onClick: handleLogout, color: 'text-danger' },
        ].map((action) => (
          <button key={action.label} onClick={action.onClick}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-background transition-colors text-left">
            <span className={action.color}>{action.icon}</span>
            <div>
              <p className={`text-sm font-medium ${action.color}`}>{action.label}</p>
              {action.desc && <p className="text-[10px] text-muted">{action.desc}</p>}
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-center text-muted">Protocol AI Engine v1.0 • Not medical advice</p>
    </div>
  );
}
