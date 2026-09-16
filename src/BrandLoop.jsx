import React, { useEffect, useRef, useState } from 'react';

const BRAND_LOOP_WORDS = ["Data", "Props", "Edge", "Signal"];

// The exact same animated wordmark as the main app header ("Krazy" static +
// a highlighted word that cycles through a few brand terms with a blinking
// cursor) -- app.js's wireBrandLoop() ported to React so the landing page
// (which is a React component, unlike the vanilla header) gets the same
// animation, word list, and timing. Styling lives in src/sports-app.css
// under the same .brand-loop* class names, just without the header's
// .hero-brand ancestor requirement.
export function BrandLoop({ className = '' }) {
  const [index, setIndex] = useState(0);
  const [isIn, setIsIn] = useState(false);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const raf = requestAnimationFrame(() => setIsIn(true));
    if (reduceMotionRef.current) return () => cancelAnimationFrame(raf);
    const interval = setInterval(() => {
      setIsIn(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % BRAND_LOOP_WORDS.length);
        setIsIn(true);
      }, 320);
    }, 3000);
    return () => { cancelAnimationFrame(raf); clearInterval(interval); };
  }, []);

  return (
    <span className={`brand-loop ${className}`}>
      <span className="brand-loop-static">Krazy</span>
      <span className={`brand-loop-rotor${isIn ? ' is-in' : ''}`}>
        <span className="brand-loop-box" aria-hidden="true" />
        <span className="brand-loop-word">{BRAND_LOOP_WORDS[index]}</span>
        <span className="brand-loop-cursor" aria-hidden="true" />
      </span>
    </span>
  );
}

export default BrandLoop;
