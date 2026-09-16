import React from 'react';
import { SparklesCore } from '../components/ui/sparkles';

// Same black + glowing-dots background as the landing page (src/LandingPage.jsx),
// extracted so the sign-in/sign-up auth card can sit on the identical
// background instead of a plain gradient -- mounted behind it from
// site-access.js via window.vortexMountSparklesBackground.
export function SparklesBackground({ particleColor = '#0082fe', particleDensity = 90 }) {
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
}

export default SparklesBackground;
