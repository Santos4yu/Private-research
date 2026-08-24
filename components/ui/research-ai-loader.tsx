"use client";

import AILoader from "@/components/ui/ai-loader";

interface ResearchAILoaderProps {
  player: string;
  stat: string;
  line: string | number;
  side: string;
}

export function ResearchAILoader({ player, stat, line, side }: ResearchAILoaderProps) {
  return (
    <section className="research-ai-loader" role="status" aria-live="polite" aria-label={`Preparing research for ${player}`}>
      <header className="research-ai-loader-head">
        <span>Preparing prop research</span>
        <strong>{player}</strong>
        <small>{side} {line} <i>•</i> {stat}</small>
      </header>
      <div className="research-ai-loader-steps">
        <AILoader className="research-ai-step" label="Loading recent game results" showElapsed variant="dots" />
        <AILoader className="research-ai-step" label="Reviewing matchup and splits" showElapsed variant="bar" />
        <AILoader className="research-ai-step" label="Building the prop score" variant="grid" />
      </div>
    </section>
  );
}
