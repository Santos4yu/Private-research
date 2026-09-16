import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/liquid-glass-button';
import { Lock } from 'lucide-react';

// The same "Administrator access" card design as the signed-out sign-in
// gate's admin mode (src/AuthCard.jsx), reused here for the hidden
// in-app admin unlock (3 rapid clicks on the settings gear) so the two
// don't look like two different products.
export function AdminPinCard({ onClose, onUnlocked }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    if (busy || !pin) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v2-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'auth', pin }),
      });
      let data;
      try { data = await res.json(); } catch { data = { error: `Server error (HTTP ${res.status})` }; }
      if (!res.ok || !data.ok) {
        setError(data.error || 'Incorrect PIN');
        return;
      }
      onUnlocked();
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Card className="w-full max-w-sm border-zinc-800 bg-zinc-900/90 backdrop-blur">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-zinc-50">Administrator access</CardTitle>
          <CardDescription className="text-zinc-400">Enter your admin passcode to manage the website.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="admin-pin" className="text-zinc-300">Admin passcode</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  id="admin-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={32}
                  value={pin} onChange={(e) => setPin(e.target.value)}
                  className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
                  autoFocus
                />
              </div>
            </div>

            {error && <p role="status" aria-live="polite" className="text-sm text-zinc-400">{error}</p>}

            <Button type="submit" disabled={busy} className="w-full h-10 rounded-lg bg-zinc-50 text-zinc-900 hover:bg-zinc-200 disabled:opacity-60">
              {busy ? 'Please wait…' : 'Unlock admin'}
            </Button>

            <button type="button" onClick={onClose} className="border-0 bg-transparent font-sans cursor-pointer w-full p-0 text-sm text-zinc-400 hover:text-zinc-200 text-center">
              Cancel
            </button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

export default AdminPinCard;
