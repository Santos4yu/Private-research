"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronUp, ClipboardList, ExternalLink, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BuilderLeg {
  id: string;
  player: string;
  side: string;
  line: string;
  stat: string;
  team: string;
  score: string;
  headshot?: string;
}
interface BuilderState {
  legs: BuilderLeg[];
  status: string;
  canExport: boolean;
  busy: boolean;
}

const EMPTY_STATE: BuilderState = {
  legs: [],
  status: "Add at least 2 props to export.",
  canExport: false,
  busy: false,
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export function ActivityDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [builder, setBuilder] = useState<BuilderState>(EMPTY_STATE);
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = Boolean(useReducedMotion());

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<Partial<BuilderState>>).detail || {};
      setBuilder((current) => ({ ...current, ...detail }));
    };
    const toggle = () => setIsOpen((open) => !open);
    const setOpen = (event: Event) => setIsOpen(Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open));
    const outside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("vortex:prop-builder-sync", sync);
    window.addEventListener("vortex:prop-builder-toggle", toggle);
    window.addEventListener("vortex:prop-builder-open", setOpen);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.dispatchEvent(new Event("vortex:prop-builder-ready"));

    return () => {
      window.removeEventListener("vortex:prop-builder-sync", sync);
      window.removeEventListener("vortex:prop-builder-toggle", toggle);
      window.removeEventListener("vortex:prop-builder-open", setOpen);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const count = builder.legs.length;
  const request = (name: string, detail?: unknown) => window.dispatchEvent(new CustomEvent(name, { detail }));

  return (
    <div ref={rootRef} className={cn("builder-activity", isOpen && "is-open")}>
      <button
        type="button"
        className="builder-activity-trigger"
        aria-expanded={isOpen}
        aria-controls="builder-activity-panel"
        onClick={() => {
          setIsOpen((open) => !open);
          if (!isOpen) request("vortex:prop-builder-request-sync");
        }}
      >
        <span className="builder-activity-icon" aria-hidden="true"><ClipboardList size={17} /></span>
        <span className="builder-activity-label"><strong>Prop Builder</strong><small>{count ? `${count} saved ${count === 1 ? "pick" : "picks"}` : "Start a slip"}</small></span>
        <span className="builder-activity-count" aria-label={`${count} saved props`}>{count}</span>
        <ChevronUp className={cn("builder-activity-chevron", !isOpen && "is-collapsed")} size={17} aria-hidden="true" />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.section
            id="builder-activity-panel"
            className="builder-activity-panel"
            aria-label="PrizePicks prop builder"
            initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5, scale: 0.99 }}
            transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="builder-activity-head">
              <span className="builder-activity-head-icon" aria-hidden="true"><ClipboardList size={18} /></span>
              <div><h2>{count ? `${count} Saved ${count === 1 ? "Prop" : "Props"}` : "Prop Builder"}</h2><p>PrizePicks bet slip · {count} of 6 legs</p></div>
              <button type="button" aria-label="Close prop builder" onClick={() => setIsOpen(false)}><ChevronUp size={17} /></button>
            </header>

            <div className="builder-activity-list" aria-live="polite">
              {count === 0 ? (
                <div className="builder-activity-empty"><ClipboardList size={22} aria-hidden="true" /><strong>Your slip is empty</strong><span>Add a prop from Research to start building.</span></div>
              ) : builder.legs.map((leg, index) => (
                <motion.article
                  className="builder-activity-leg"
                  key={leg.id}
                  initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reducedMotion ? 0 : index * 0.045, duration: reducedMotion ? 0 : 0.2 }}
                >
                  <span className="builder-activity-avatar">
                    <span>{initials(leg.player)}</span>
                    {leg.headshot ? <img src={leg.headshot} alt="" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
                  </span>
                  <span className="builder-activity-copy"><strong>{leg.player}</strong><span>{leg.side} {leg.line} {leg.stat}</span><small>{leg.team} · Score {leg.score}</small></span>
                  <button type="button" className="builder-activity-remove" aria-label={`Remove ${leg.player}`} onClick={() => request("vortex:prop-builder-remove", { id: leg.id })}><X size={15} /></button>
                </motion.article>
              ))}
            </div>

            <footer className="builder-activity-footer">
              <p>{builder.status}</p>
              <div>
                <button type="button" className="builder-activity-clear" disabled={!count || builder.busy} onClick={() => request("vortex:prop-builder-clear")}><Trash2 size={15} />Clear</button>
                <button type="button" className="builder-activity-export" disabled={!builder.canExport || builder.busy} onClick={() => request("vortex:prop-builder-export")}><span>{builder.busy ? "Checking lines…" : "Export to PrizePicks"}</span><ExternalLink size={15} /></button>
              </div>
              <small>Live lines are rechecked before PrizePicks opens. You review and submit inside PrizePicks.</small>
            </footer>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
