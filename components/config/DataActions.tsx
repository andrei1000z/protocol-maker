'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Download, RotateCcw, LogOut } from 'lucide-react';

export function DataActions() {
  const [showReset, setShowReset] = useState(false);

  const handleExport = async () => {
    const res = await fetch('/api/my-data?rangeStart=2020-01-01&rangeEnd=2030-12-31');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = async () => {
    await fetch('/api/reset', { method: 'POST' });
    setShowReset(false);
    window.location.href = '/onboarding';
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <>
      <Card>
        <h3 className="text-sm font-medium mb-4">Date</h3>
        <div className="space-y-2">
          <Button variant="secondary" onClick={handleExport} className="w-full flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Export JSON Backup
          </Button>
          <Button variant="danger" onClick={() => setShowReset(true)} className="w-full flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reset Complet
          </Button>
        </div>
      </Card>

      <Card>
        <Button variant="ghost" onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-muted-foreground">
          <LogOut className="w-4 h-4" /> Deconectare
        </Button>
      </Card>

      <Modal open={showReset} onClose={() => setShowReset(false)} title="Reset Complet?">
        <p className="text-sm text-muted-foreground mb-4">
          Toate datele vor fi șterse permanent: profil, protocol, log-uri zilnice, configurări.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowReset(false)} className="flex-1">Anulează</Button>
          <Button variant="danger" onClick={handleReset} className="flex-1">Șterge Tot</Button>
        </div>
      </Modal>
    </>
  );
}
