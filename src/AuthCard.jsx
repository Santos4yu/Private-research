import React, { useState, useRef, useLayoutEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/liquid-glass-button';
import { Checkbox } from '../components/ui/checkbox';
import { Separator } from '../components/ui/separator';
import { SparklesBackground } from './SparklesBackground';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

// Ported as-given from the pasted "login-signup" design (particles +
// accent-line intro + fade-up card), with only the GitHub/Google buttons
// removed per instruction, and wired to the site's real Supabase-backed
// /api/session and /api/v2-admin endpoints (same contract src/site-access.js's
// old vanilla authForm() used) so sign-in, sign-up, password recovery and
// admin access all still work.
async function request(url, body) {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('Service temporarily unavailable. Please try again.'); }
  if (!response.ok) throw new Error(data.error || 'Request unavailable');
  return data;
}

const HEADINGS = { 'sign-in': 'Welcome back', 'sign-up': 'Create your account', recover: 'Reset your password', 'verify-recovery': 'Check your email', 'update-password': 'Choose a new password', admin: 'Administrator access' };
const SUBTITLES = { 'sign-in': 'Sign in to your research workspace.', 'sign-up': 'Your MLB and NFL research, in one place.', recover: 'We will send a recovery code to your email.', 'verify-recovery': 'Enter the recovery code to continue.', 'update-password': 'Use at least 8 characters.', admin: 'Enter your admin passcode to manage the website.' };
const SUBMIT_LABEL = { 'sign-in': 'Sign in', 'sign-up': 'Create account', recover: 'Send recovery code', 'verify-recovery': 'Verify code', 'update-password': 'Save password', admin: 'Unlock admin' };

export function AuthCard({ initialMode = 'sign-in', registrationOpen = true, accountEmail = '' }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState(accountEmail);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Sign in and Create account render a different set of fields (the
  // "Remember me" row only shows for sign-in), so the card's height jumps
  // between the two -- animate that height change instead of letting it
  // pop. cardSizerRef is the fixed-height box the transition runs on;
  // cardInnerRef is the actual content it measures every render.
  const cardSizerRef = useRef(null);
  const cardInnerRef = useRef(null);
  useLayoutEffect(() => {
    const sizer = cardSizerRef.current, inner = cardInnerRef.current;
    if (!sizer || !inner) return;
    sizer.style.height = inner.offsetHeight + 'px';
    const observer = new ResizeObserver(() => {
      sizer.style.height = inner.offsetHeight + 'px';
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  function switchMode(next) {
    if (busy) return;
    setMode(next);
    setFeedback('');
    setPassword('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback('');
    try {
      const fields = { email, password, code, pin };
      const data = await request(mode === 'admin' ? '/api/v2-admin' : '/api/session', { action: mode === 'admin' ? 'auth' : mode, ...fields });
      if (mode === 'recover') {
        setBusy(false);
        switchMode('verify-recovery');
        setFeedback('If your account exists, a recovery email will arrive shortly.');
        return;
      } else if (mode === 'verify-recovery') {
        setBusy(false);
        switchMode('update-password');
        setPassword('');
        return;
      } else if (mode === 'sign-up' && !data.signedIn) {
        setFeedback(data.message || 'Account could not be created. Please try signing in.');
      } else {
        // Admin unlock still grants access, it just no longer jumps straight
        // to the admin panel -- land on the regular research home like any
        // other sign-in, same as the vanilla authForm() this replaced used
        // to do before it started forcing #admin.
        location.pathname = '/research';
        return;
      }
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setBusy(false);
    }
  }

  const showEmail = !['admin', 'update-password'].includes(mode);
  const showPasswordField = ['sign-in', 'sign-up', 'update-password'].includes(mode);
  const showCode = mode === 'verify-recovery';
  const showPin = mode === 'admin';
  const showModes = ['sign-in', 'sign-up'].includes(mode);
  const showForgot = mode === 'sign-in';
  const showBack = !showModes;

  return (
    <section className="fixed inset-0 bg-black text-zinc-50">
      <style>{`
        .card-animate{opacity:0;transform:translateY(20px);animation:fadeUp 0.8s cubic-bezier(.22,.61,.36,1) 0.4s forwards}
        @keyframes fadeUp{to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Same glowing-dots sparkles background as the landing page, not the
          pasted design's own canvas particles + accent lines, so the two
          screens match exactly. */}
      <SparklesBackground />

      <header className="absolute z-10 left-0 right-0 top-0 flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
        <span className="text-xs tracking-[0.14em] uppercase text-zinc-400">Krazy Data</span>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-50 hover:bg-zinc-900/80"
          onClick={() => { location.pathname = '/research'; }}
        >
          Back to home
        </Button>
      </header>

      <div className="relative z-10 h-full w-full grid place-items-center px-4">
        <div ref={cardSizerRef} className="card-animate w-full max-w-sm overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(.22,.61,.36,1)]">
        <div ref={cardInnerRef}>
        <Card className="w-full border-zinc-800 bg-zinc-900/70 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60">
          <CardHeader className="space-y-1">
            {showModes && (
              <div className="flex gap-1 rounded-lg bg-zinc-950 border border-zinc-800 p-1 mb-2" role="group" aria-label="Account access">
                <button type="button" onClick={() => switchMode('sign-in')} aria-pressed={mode === 'sign-in'} className={`border-0 font-sans cursor-pointer flex-1 h-8 rounded-md text-sm font-medium transition-colors ${mode === 'sign-in' ? 'bg-zinc-50 text-zinc-900' : 'bg-transparent text-zinc-400 hover:text-zinc-200'}`}>Sign in</button>
                <button type="button" onClick={() => registrationOpen && switchMode('sign-up')} aria-pressed={mode === 'sign-up'} disabled={!registrationOpen} className={`border-0 font-sans cursor-pointer flex-1 h-8 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'sign-up' ? 'bg-zinc-50 text-zinc-900' : 'bg-transparent text-zinc-400 hover:text-zinc-200'}`}>Create account</button>
              </div>
            )}
            <CardTitle className="text-2xl">{HEADINGS[mode]}</CardTitle>
            <CardDescription className="text-zinc-400">{SUBTITLES[mode]}</CardDescription>
          </CardHeader>

          <form onSubmit={onSubmit}>
            <CardContent className="grid gap-5">
              {showEmail && (
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-zinc-300">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600" />
                  </div>
                </div>
              )}

              {showPasswordField && (
                <div className="grid gap-2">
                  <Label htmlFor="password" className="text-zinc-300">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      id="password" name="password" type={showPassword ? 'text' : 'password'} required minLength={8} maxLength={128}
                      autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600"
                    />
                    <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} className="border-0 bg-transparent font-sans cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-zinc-400 hover:text-zinc-200" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {showCode && (
                <div className="grid gap-2">
                  <Label htmlFor="code" className="text-zinc-300">Recovery code</Label>
                  <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="Code from your email" value={code} onChange={(e) => setCode(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600" />
                </div>
              )}

              {showPin && (
                <div className="grid gap-2">
                  <Label htmlFor="pin" className="text-zinc-300">Admin passcode</Label>
                  <Input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={32} value={pin} onChange={(e) => setPin(e.target.value)} className="bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600" />
                </div>
              )}

              {mode === 'sign-in' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" className="border-zinc-700 data-[state=checked]:bg-zinc-50 data-[state=checked]:text-zinc-900" />
                    <Label htmlFor="remember" className="text-zinc-400">Remember me</Label>
                  </div>
                  {showForgot && (
                    <button type="button" onClick={() => switchMode('recover')} className="border-0 bg-transparent font-sans cursor-pointer p-0 text-sm text-zinc-300 hover:text-zinc-100">Forgot password?</button>
                  )}
                </div>
              )}

              {feedback && <p role="status" aria-live="polite" className="text-sm text-zinc-400">{feedback}</p>}

              <Button type="submit" disabled={busy} className="w-full h-10 rounded-lg bg-zinc-50 text-zinc-900 hover:bg-zinc-200 disabled:opacity-60">
                {busy ? 'Please wait…' : SUBMIT_LABEL[mode]}
              </Button>

              {showBack && (
                <button type="button" onClick={() => switchMode('sign-in')} className="border-0 bg-transparent font-sans cursor-pointer w-full p-0 text-sm text-zinc-400 hover:text-zinc-200 text-center">Back to sign in</button>
              )}

              <div className="relative">
                <Separator className="bg-zinc-800" />
                <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-zinc-900/70 px-2 text-[11px] uppercase tracking-widest text-zinc-500">or</span>
              </div>
            </CardContent>
          </form>

          <CardFooter className="flex flex-col items-center gap-3 text-sm text-zinc-400">
            {showModes && (
              <div>
                {mode === 'sign-in' ? "Don't have an account?" : 'Already have an account?'}
                <button type="button" onClick={() => registrationOpen && switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')} className="border-0 bg-transparent font-sans cursor-pointer p-0 ml-1 text-zinc-200 hover:underline">
                  {mode === 'sign-in' ? 'Create one' : 'Sign in'}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => switchMode('admin')}
              className="border-0 bg-transparent font-sans cursor-pointer p-0 text-[10px] tracking-wide text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Administrator
            </button>
          </CardFooter>
        </Card>
        </div>
        </div>
      </div>
    </section>
  );
}

export default AuthCard;
