import React, { useState } from 'react';
import { Search, LayoutGrid, Puzzle, MessageCircle, ArrowRight } from 'lucide-react';
import { SparklesCore } from '../components/ui/sparkles';

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
    <div className="relative w-full min-h-screen bg-black overflow-hidden flex flex-col">
      <div className="absolute inset-0">
        <SparklesCore
          background="transparent"
          minSize={0.4}
          maxSize={1.2}
          particleDensity={90}
          particleColor="#0082fe"
          className="w-full h-full"
        />
      </div>

      <div className="relative z-10 flex flex-col items-center flex-1 px-6 pt-12 pb-10">
        <div className="flex items-center gap-2 mb-10">
          <img src="/icons/kd-mark.png" width={32} height={32} alt="" className="rounded-lg" />
          <span className="font-sans text-white font-semibold text-sm tracking-wide">Krazy Data</span>
        </div>

        <div className="flex bg-white/5 rounded-full p-1 mb-10 border border-white/10">
          <button type="button" onClick={() => setTab('home')} className={`border-0 font-sans px-5 py-2 rounded-full text-sm font-medium transition ${tab === 'home' ? 'bg-white/15 text-white' : 'bg-transparent text-gray-400 hover:text-white'}`}>Home</button>
          <button type="button" onClick={() => setTab('about')} className={`border-0 font-sans px-5 py-2 rounded-full text-sm font-medium transition ${tab === 'about' ? 'bg-white/15 text-white' : 'bg-transparent text-gray-400 hover:text-white'}`}>About</button>
        </div>

        {tab === 'home' ? (
          <div className="flex flex-col items-center text-center max-w-xl flex-1 justify-center">
            <h1 className="font-sans text-5xl sm:text-7xl font-bold text-white mb-4 tracking-tight">
              Krazy<span className="text-[#0082fe]">Data</span>
            </h1>
            <p className="font-sans text-gray-400 text-base sm:text-lg mb-10 max-w-md">
              Deep MLB &amp; NFL research, live prop boards, and a parlay builder — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button type="button" onClick={onSignUp} className="border-0 font-sans bg-[#0082fe] text-white font-semibold px-8 py-3 rounded-full shadow hover:brightness-110 transition text-sm">
                Sign up
              </button>
              <button type="button" onClick={onSignIn} className="border-0 font-sans bg-white/10 text-white font-medium px-8 py-3 rounded-full shadow hover:bg-white/20 transition text-sm">
                Sign in
              </button>
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
