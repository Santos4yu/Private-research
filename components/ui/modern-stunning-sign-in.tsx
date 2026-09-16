"use client";

import * as React from "react";
import { useState } from "react";

// Adapted from the pasted "modern-stunning-sign-in" (HextaUI) design: same
// glass-card look, pill buttons, and bg-white/10 inputs, extended to cover
// every mode the site's real auth form (src/site-access.js authForm())
// already supports -- sign in, create account, forgot-password recovery,
// and the admin passcode unlock -- and wired to the real /api/session and
// /api/v2-admin endpoints instead of the original's local-only demo state.
// The original's "Continue with Google" button was dropped (no Google
// OAuth exists here, only a separate Discord system), and the fake
// "thousands of developers" avatar footer was dropped since it's not real.

type Mode = "sign-in" | "sign-up" | "recover" | "verify-recovery" | "update-password" | "admin";

const HEADINGS: Record<Mode, string> = {
  "sign-in": "Welcome back",
  "sign-up": "Create your account",
  recover: "Reset your password",
  "verify-recovery": "Check your email",
  "update-password": "Choose a new password",
  admin: "Administrator access",
};
const SUBTITLES: Record<Mode, string> = {
  "sign-in": "Sign in to your research workspace.",
  "sign-up": "Your MLB and NFL research, in one place.",
  recover: "We will send a recovery code to your email.",
  "verify-recovery": "Enter the recovery code to continue.",
  "update-password": "Use at least 8 characters.",
  admin: "Enter your admin passcode to manage the website.",
};
const SUBMIT_LABEL: Record<Mode, string> = {
  "sign-in": "Sign in",
  "sign-up": "Create account",
  recover: "Send recovery code",
  "verify-recovery": "Verify code",
  "update-password": "Save password",
  admin: "Unlock admin",
};

async function request(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("Service temporarily unavailable. Please try again.");
  }
  if (!response.ok) throw new Error(data.error || "Request unavailable");
  return data;
}

export interface SignIn1Props {
  initialEmail?: string;
  registrationOpen?: boolean;
  /** Locks the card to a single mode with no sign-in/sign-up/back navigation -- used while accounts aren't configured yet, or from the maintenance screen's Administrator link. */
  forceMode?: Mode;
}

const SignIn1 = ({ initialEmail = "", registrationOpen = true, forceMode }: SignIn1Props) => {
  const [mode, setModeState] = useState<Mode>(forceMode ?? "sign-in");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const setMode = (next: Mode) => {
    if (busy) return;
    setModeState(next);
    setFeedback("");
  };

  const showEmail = !["admin", "update-password"].includes(mode);
  const showPasswordField = ["sign-in", "sign-up", "update-password"].includes(mode);
  const showCode = mode === "verify-recovery";
  const showPin = mode === "admin";
  const showModeSwitch = !forceMode && ["sign-in", "sign-up"].includes(mode);
  const showForgot = !forceMode && mode === "sign-in";
  const showBack = !forceMode && !["sign-in", "sign-up"].includes(mode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback("");
    try {
      const fields: Record<string, unknown> = {};
      if (showEmail) fields.email = email;
      if (showPasswordField) fields.password = password;
      if (showCode) fields.code = code;
      if (showPin) fields.pin = pin;
      const url = mode === "admin" ? "/api/v2-admin" : "/api/session";
      const action = mode === "admin" ? "auth" : mode;
      const data = await request(url, { action, ...fields });
      if (mode === "recover") {
        setBusy(false);
        setMode("verify-recovery");
        setFeedback("If your account exists, a recovery email will arrive shortly.");
        return;
      }
      if (mode === "verify-recovery") {
        setBusy(false);
        setMode("update-password");
        setPassword("");
        return;
      }
      if (mode === "sign-up" && !data.signedIn) {
        setFeedback(data.message || "Account could not be created. Please try signing in.");
        setBusy(false);
        return;
      }
      if (mode === "admin") window.location.hash = "admin";
      window.location.reload();
    } catch (error: any) {
      setFeedback(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-gradient-to-r from-[#ffffff10] to-[#121212] backdrop-blur-sm shadow-2xl p-8 flex flex-col items-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 mb-6 shadow-lg overflow-hidden">
          <img src="/icons/kd-mark.png" alt="" width={40} height={40} />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-1 text-center">{HEADINGS[mode]}</h2>
        <p className="text-sm text-gray-400 mb-6 text-center">{SUBTITLES[mode]}</p>

        {showModeSwitch && (
          <div className="flex w-full rounded-full bg-white/5 p-1 mb-5" role="group" aria-label="Account access">
            <button type="button" onClick={() => setMode("sign-in")} className={`flex-1 rounded-full border-0 px-3 py-2 font-sans text-sm font-medium transition ${mode === "sign-in" ? "bg-white/15 text-white" : "bg-transparent text-gray-400 hover:text-white"}`}>Sign in</button>
            <button type="button" onClick={() => registrationOpen && setMode("sign-up")} disabled={!registrationOpen} className={`flex-1 rounded-full border-0 px-3 py-2 font-sans text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${mode === "sign-up" ? "bg-white/15 text-white" : "bg-transparent text-gray-400 hover:text-white"}`}>Create account</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col w-full gap-4">
          <div className="w-full flex flex-col gap-3">
            {showEmail && (
              <input
                placeholder="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                disabled={busy}
                className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
            {showPasswordField && (
              <div className="relative">
                <input
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  minLength={8}
                  maxLength={128}
                  required
                  value={password}
                  disabled={busy}
                  className="w-full px-5 py-3 pr-16 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 border-0 bg-transparent p-0 font-sans text-xs text-gray-400 hover:text-white">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            )}
            {showCode && (
              <input
                placeholder="Code from your email"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                disabled={busy}
                className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                onChange={(e) => setCode(e.target.value)}
              />
            )}
            {showPin && (
              <input
                placeholder="Admin passcode"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={32}
                required
                value={pin}
                disabled={busy}
                className="w-full px-5 py-3 rounded-xl bg-white/10 text-white placeholder-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                onChange={(e) => setPin(e.target.value)}
              />
            )}
            {feedback && <div role="status" aria-live="polite" className="text-sm text-red-400 text-left">{feedback}</div>}
          </div>

          {showForgot && (
            <div className="w-full text-right -mt-2">
              <button type="button" onClick={() => setMode("recover")} className="border-0 bg-transparent p-0 font-sans text-xs text-white/60 hover:text-white underline">Forgot password?</button>
            </div>
          )}

          <hr className="opacity-10" />

          <div className="w-full">
            <button
              type="submit"
              disabled={busy}
              className="w-full border-0 bg-white/10 text-white font-sans font-medium px-5 py-3 rounded-full shadow hover:bg-white/20 transition text-sm disabled:opacity-60"
            >
              {busy ? "Please wait…" : SUBMIT_LABEL[mode]}
            </button>
            {showBack && (
              <button type="button" onClick={() => setMode("sign-in")} className="w-full border-0 bg-transparent p-0 mt-3 font-sans text-center text-xs text-gray-400 hover:text-white underline">
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export { SignIn1 };
export default SignIn1;
