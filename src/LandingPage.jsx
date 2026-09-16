import React, { useState } from 'react';
import { Search, LayoutGrid, Puzzle, MessageCircle, ArrowRight } from 'lucide-react';
import { LiquidButton } from '../components/ui/liquid-glass-button';
import { SparklesBackground } from './SparklesBackground';
import { BrandLoop } from './BrandLoop';

const FEATURES = [
  { icon: Search, title: 'Player research', copy: 'Hit-rate trends and matchup scoring for every MLB and NFL player.' },
  { icon: LayoutGrid, title: 'Live prop boards', copy: 'Graded MLB and NFL prop boards and moneyline research, updated live.' },
  { icon: Puzzle, title: 'Parlay builder', copy: 'Build parlays automatically and export straight to PrizePicks.' },
  { icon: MessageCircle, title: 'Community', copy: 'Share your picks in Community and react to what everyone else is playing.' },
];

// The site's real front door for anyone signed out: shown every time (see
// site-access.js renderStatus -- this replaces the old one-time welcome
// overlay), with the actual sign-in/sign-up form reached only after
// choosing one of the two buttons here.
export function LandingPage({ onSignUp, onSignIn }) {
  const [tab, setTab] = useState('home');

  return (
    // 100dvh (not the old min-h-screen/100vh) so this actually matches the
    // real visible viewport on mobile browsers -- 100vh undercounts/overcounts
    // as address bars show/hide, which is what left a gray gap at the bottom
    // (the fixed #site-policy-gate parent behind this already spans inset:0,
    // so a static-vh child never quite lined up with it). Safe-area padding
    // on every edge matches the pattern already used everywhere else in this
    // app (see src/mobile-app.css) instead of letting the header sit under
    // a phone's notch/status bar.
    <div
      className="relative w-full bg-black overflow-hidden flex flex-col"
      style={{
        minHeight: '100dvh',
        paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
        boxSizing: 'border-box',
      }}
    >
      <SparklesBackground />

      {/* justify-center centers the whole block (logo, tabs, hero text,
          buttons) together as one unit in the middle of the viewport --
          previously only the hero text centered in the space left over
          below the header, which read as sitting too low. */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full">
        <div className="flex items-center gap-2 mb-10">
          <img src="/icons/kd-mark.png" width={32} height={32} alt="" className="rounded-lg" />
          <span className="font-sans text-white font-semibold text-sm tracking-wide">Krazy Data</span>
        </div>

        <div className="flex gap-2 mb-10">
          <LiquidButton type="button" size="sm" onClick={() => setTab('home')} className={`border-0 font-sans ${tab === 'home' ? 'text-white' : 'text-gray-400'}`}>Home</LiquidButton>
          <LiquidButton type="button" size="sm" onClick={() => setTab('about')} className={`border-0 font-sans ${tab === 'about' ? 'text-white' : 'text-gray-400'}`}>About</LiquidButton>
        </div>

        {tab === 'home' ? (
          <div className="flex flex-col items-center text-center max-w-xl">
            <h1 className="mb-4">
              <BrandLoop className="text-5xl sm:text-7xl font-bold tracking-tight" />
            </h1>
            <p className="font-sans text-gray-400 text-base sm:text-lg mb-10 max-w-md">
              Deep MLB &amp; NFL research, live prop boards, and a parlay builder — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-center">
              <LiquidButton type="button" size="lg" onClick={onSignUp} className="border-0 font-sans text-white w-full sm:w-auto">
                Sign up
              </LiquidButton>
              <LiquidButton type="button" size="lg" onClick={onSignIn} className="border-0 font-sans text-white w-full sm:w-auto">
                Sign in
              </LiquidButton>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <h2 className="font-sans text-2xl sm:text-3xl font-bold text-white text-center mb-3">What Krazy Data does</h2>
            <p className="font-sans text-gray-400 text-center mb-10 text-sm sm:text-base">Everything you need to research a prop before you play it.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {FEATURES.map(({ icon: Icon, title, copy }) => (
                <div key={title} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <Icon size={20} className="text-[#0082fe]" aria-hidden="true" />
                  <strong className="font-sans text-white text-sm">{title}</strong>
                  <span className="font-sans text-gray-400 text-xs leading-relaxed">{copy}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-center mt-10">
              <button type="button" onClick={onSignUp} className="border-0 font-sans bg-[#0082fe] text-white font-semibold px-8 py-3 rounded-full shadow hover:brightness-110 transition text-sm inline-flex items-center gap-2">
                Get started <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LandingPage;
