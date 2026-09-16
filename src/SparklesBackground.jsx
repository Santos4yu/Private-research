import React, { memo } from 'react';
import { SparklesCore } from '../components/ui/sparkles';

// Same black + glowing-dots background as the landing page (src/LandingPage.jsx),
// extracted so the sign-in/sign-up auth card can sit on the identical
// background instead of a plain gradient -- mounted behind it from
// site-access.js via window.vortexMountSparklesBackground.
//
// memo()'d because @tsparticles/react's <Particles> reinitializes its whole
// particle system on every one of its own re-renders (its effect depends on
// the entire props object, not just the parts that actually changed) -- and
// React re-renders a child on every parent re-render by default, regardless
// of whether the child's props changed. Sitting behind the auth card, that
// meant the dots visibly jumped on every keystroke in the email/password
// fields. With this called with no props from AuthCard/LandingPage, memo
// makes React skip re-rendering it (and therefore Particles) entirely
// instead of relying on the library's own (broken) reinit check.
export const SparklesBackground = memo(function SparklesBackground({ particleColor = '#0082fe', particleDensity = 90 }) {
  return (
    <div className="absolute inset-0 bg-black overflow-hidden">
      <SparklesCore
        background="transparent"
        minSize={0.4}
        maxSize={1.2}
        particleDensity={particleDensity}
        particleColor={particleColor}
        className="w-full h-full"
      />
    </div>
  );
});

export default SparklesBackground;
