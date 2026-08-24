"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, Send } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ActionSearchBarProps {
  placeholder?: string;
  inputId?: string;
  resultsId?: string;
}

function ActionSearchBar({
  placeholder = "Search a player",
  inputId = "search-input",
  resultsId = "search-results",
}: ActionSearchBarProps) {
  const [query, setQuery] = React.useState("");
  const [resultsOpen, setResultsOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resultsRef = React.useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion();

  React.useLayoutEffect(() => {
    window.dispatchEvent(new Event("vortex:search-ready"));
  }, []);

  React.useEffect(() => {
    const clear = () => setQuery("");
    window.addEventListener("vortex:search-clear", clear);
    return () => window.removeEventListener("vortex:search-clear", clear);
  }, []);

  React.useEffect(() => {
    const results = resultsRef.current;
    if (!results) return;
    const sync = () => setResultsOpen(!results.hidden);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(results, { attributes: true, attributeFilter: ["hidden"] });
    return () => observer.disconnect();
  }, []);

  const submitOrFocus = () => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (query.trim().length > 1) {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
  };

  const iconMotion = reduceMotion
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: -8, scale: 0.9 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 8, scale: 0.9 },
      };

  return (
    <div className="action-search-bar">
      <label className="sr-only" htmlFor={inputId}>Search MLB players</label>
      <div className="search-box action-search-field">
        <Input
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={resultsId}
          aria-expanded={resultsOpen}
          className="action-search-input"
        />
        <button
          type="button"
          className="action-search-submit"
          aria-label={query.trim() ? "Search entered player" : "Focus player search"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={submitOrFocus}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={query.length > 0 ? "send" : "search"}
              {...iconMotion}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
            >
              {query.length > 0
                ? <Send size={19} strokeWidth={1.8} aria-hidden="true" />
                : <Search size={20} strokeWidth={1.8} aria-hidden="true" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <ul className="search-results" id={resultsId} ref={resultsRef} hidden />
    </div>
  );
}

export { ActionSearchBar };
