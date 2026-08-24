"use client";

import { cn } from "@/lib/utils";
import { motion, useAnimationFrame, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";

export const AI_LOADER_CYCLE_SECONDS = 1.2;

const DOT_COUNT = 3;
const GRID_CELLS = 9;
const GRID_DELAYS = [0, 1, 2, 1, 2, 3, 2, 3, 4];
const EASE_IN_OUT = [0.645, 0.045, 0.355, 1] as const;

export type AILoaderVariant = "dots" | "bar" | "grid";

export type AILoaderProps = {
  className?: string;
  label?: string;
  showElapsed?: boolean;
  variant?: AILoaderVariant;
};

const Dots = ({ reduced }: { reduced: boolean }) => (
  <span className="flex items-center gap-1" aria-hidden="true">
    {Array.from({ length: DOT_COUNT }, (_, index) => (
      <motion.span
        animate={reduced ? { opacity: 0.5 } : { opacity: [0.25, 1, 0.25] }}
        className="size-1.5 rounded-full bg-current"
        key={index}
        transition={reduced ? { duration: 0 } : {
          delay: (index * AI_LOADER_CYCLE_SECONDS) / (DOT_COUNT * 2),
          duration: AI_LOADER_CYCLE_SECONDS,
          ease: EASE_IN_OUT,
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
    ))}
  </span>
);

const Bar = ({ reduced }: { reduced: boolean }) => (
  <span className="relative block h-1 w-24 overflow-hidden rounded-full bg-current/15" aria-hidden="true">
    <motion.span
      animate={reduced ? { x: "0%" } : { x: ["-100%", "200%"] }}
      className="absolute inset-y-0 w-1/3 rounded-full bg-current"
      transition={reduced ? { duration: 0 } : {
        duration: AI_LOADER_CYCLE_SECONDS * 1.4,
        ease: EASE_IN_OUT,
        repeat: Number.POSITIVE_INFINITY,
      }}
    />
  </span>
);

const Grid = ({ reduced }: { reduced: boolean }) => (
  <span className="grid grid-cols-3 gap-0.5" aria-hidden="true">
    {Array.from({ length: GRID_CELLS }, (_, index) => (
      <motion.span
        animate={reduced ? { opacity: 0.45 } : { opacity: [0.2, 1, 0.2] }}
        className="size-1.5 rounded-[2px] bg-current"
        key={index}
        transition={reduced ? { duration: 0 } : {
          delay: ((GRID_DELAYS[index] ?? 0) * AI_LOADER_CYCLE_SECONDS) / 8,
          duration: AI_LOADER_CYCLE_SECONDS,
          ease: EASE_IN_OUT,
          repeat: Number.POSITIVE_INFINITY,
        }}
      />
    ))}
  </span>
);

const Elapsed = () => {
  const startRef = useRef<number | null>(null);
  const [seconds, setSeconds] = useState(0);

  useAnimationFrame((time) => {
    const start = startRef.current ?? time;
    startRef.current = start;
    const next = (time - start) / 1000;
    setSeconds((current) => next.toFixed(1) === current.toFixed(1) ? current : next);
  });

  return <span className="tabular-nums opacity-60" aria-hidden="true">{seconds.toFixed(1)}s</span>;
};

const AILoader = ({ className, label, showElapsed = false, variant = "dots" }: AILoaderProps) => {
  const reduced = Boolean(useReducedMotion());

  return (
    <span className={cn("inline-flex items-center gap-2 text-sm", className)}>
      {label ? <span>{label}</span> : null}
      {variant === "dots" && <Dots reduced={reduced} />}
      {variant === "bar" && <Bar reduced={reduced} />}
      {variant === "grid" && <Grid reduced={reduced} />}
      {showElapsed ? <Elapsed /> : null}
    </span>
  );
};

export default AILoader;
