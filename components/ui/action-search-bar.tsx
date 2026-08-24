"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { motion, useReducedMotion } from "framer-motion";
import { Clock3, Search, UserRound } from "lucide-react";

type PlayerEntry = {
  kind?: "static" | "live" | "recent";
  player: string;
  team?: string;
  playerId?: number;
  teamId?: number;
  sport?: string;
  sub?: string;
  headshot?: string | null;
};

type SearchPayload = {
  entries?: PlayerEntry[];
  loading?: boolean;
  fetchFailed?: boolean;
  showLiveOption?: boolean;
  query?: string;
};

interface ActionSearchBarProps {
  placeholder?: string;
  inputId?: string;
  resultsId?: string;
}

const RECENT_SEARCH_KEY = "private_recent_player_searches_v1";
const MAX_RECENT_SEARCHES = 5;

function loadRecentSearches(): PlayerEntry[] {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || "[]");
    return Array.isArray(saved) ? saved.slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(entry: PlayerEntry) {
  const normalized = entry.player.trim().toLocaleLowerCase();
  const next = [entry, ...loadRecentSearches().filter((item) => item.player.trim().toLocaleLowerCase() !== normalized)]
    .slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
  return next;
}

function playerHeadshot(entry: PlayerEntry) {
  if (entry.headshot) return entry.headshot.replace("/headshot/67/current", "/headshot/silo/current");
  if (entry.playerId) return `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${entry.playerId}/headshot/silo/current`;
  return "";
}

function teamLogo(entry: PlayerEntry) {
  return entry.teamId ? `https://www.mlbstatic.com/team-logos/${entry.teamId}.svg` : "";
}

function ActionSearchBar({
  placeholder = "Search MLB players",
  inputId = "search-input",
  resultsId = "search-results",
}: ActionSearchBarProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [payload, setPayload] = React.useState<SearchPayload>({ entries: [] });
  const [recent, setRecent] = React.useState<PlayerEntry[]>([]);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  React.useLayoutEffect(() => {
    setRecent(loadRecentSearches());
    inputRef.current?.setAttribute("id", inputId);
    inputRef.current?.setAttribute("aria-controls", resultsId);
    listRef.current?.setAttribute("id", resultsId);
    window.dispatchEvent(new Event("vortex:search-ready"));
  }, [inputId, resultsId]);

  React.useLayoutEffect(() => {
    inputRef.current?.setAttribute("aria-expanded", String(open));
  }, [open]);

  React.useEffect(() => {
    const showResults = (event: Event) => {
      const next = (event as CustomEvent<SearchPayload>).detail || {};
      setPayload(next);
      setOpen(true);
    };
    const showRecent = () => {
      setRecent(loadRecentSearches());
      setPayload({ entries: [] });
      setOpen(true);
    };
    const hide = () => setOpen(false);
    const clear = () => {
      setQuery("");
      setPayload({ entries: [] });
    };
    window.addEventListener("vortex:search-results", showResults);
    window.addEventListener("vortex:search-show-recent", showRecent);
    window.addEventListener("vortex:search-hide", hide);
    window.addEventListener("vortex:search-clear", clear);
    return () => {
      window.removeEventListener("vortex:search-results", showResults);
      window.removeEventListener("vortex:search-show-recent", showRecent);
      window.removeEventListener("vortex:search-hide", hide);
      window.removeEventListener("vortex:search-clear", clear);
    };
  }, []);

  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onShortcut);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onShortcut);
    };
  }, []);

  const selectEntry = (entry: PlayerEntry) => {
    setRecent(saveRecentSearch(entry));
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    window.dispatchEvent(new CustomEvent("vortex:player-search-select", { detail: { entry } }));
  };

  const searchExactName = () => {
    const player = query.trim();
    if (!player) return;
    setRecent(saveRecentSearch({ player, kind: "recent", sport: "MLB" }));
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    window.dispatchEvent(new CustomEvent("vortex:player-search-select", { detail: { query: player } }));
  };

  const entries = query.trim() ? (payload.entries || []) : recent;
  const heading = query.trim() ? "Players" : "Recently searched";
  const showExact = Boolean(query.trim().length > 1 && payload.showLiveOption);

  return (
    <div className="command-player-search" ref={rootRef}>
      <CommandPrimitive shouldFilter={false} loop className="command-player-shell">
        <div className="command-player-field">
          <Search size={17} strokeWidth={1.8} aria-hidden="true" />
          <CommandPrimitive.Input
            ref={inputRef}
            id={inputId}
            value={query}
            onValueChange={setQuery}
            onFocus={() => {
              setOpen(true);
              if (!query.trim()) window.dispatchEvent(new Event("vortex:search-show-recent"));
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                inputRef.current?.blur();
              }
            }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            aria-label="Search MLB players"
            aria-controls={resultsId}
            aria-expanded={open}
          />
          <kbd aria-label="Keyboard shortcut Control K"><span>Ctrl</span>K</kbd>
        </div>

        <motion.div
          className="command-player-popover"
          data-open={open ? "true" : "false"}
          aria-hidden={!open}
          initial={false}
          animate={reduceMotion ? { opacity: open ? 1 : 0 } : { opacity: open ? 1 : 0, y: open ? 0 : -6, scale: open ? 1 : 0.985 }}
          transition={{ duration: reduceMotion ? 0 : open ? 0.18 : 0.12, ease: open ? [0.2, 0.75, 0.25, 1] : "easeIn" }}
        >
          <div className="command-player-heading">
            {query.trim() ? <Search size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}
            <span>{heading}</span>
          </div>
          <CommandPrimitive.List ref={listRef} className="command-player-list" aria-label={heading}>
            {entries.map((entry) => {
              const headshot = playerHeadshot(entry);
              const logo = teamLogo(entry);
              return (
                <CommandPrimitive.Item
                  key={`${entry.playerId || entry.player}-${entry.team || "MLB"}`}
                  value={`${entry.player}-${entry.team || ""}`}
                  onSelect={() => selectEntry(entry)}
                  className="command-player-item"
                >
                  <span className="command-player-avatar">
                    <UserRound size={17} aria-hidden="true" />
                    {headshot ? <img src={headshot} alt="" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
                  </span>
                  <span className="command-player-copy">
                    <strong>{entry.player}</strong>
                    <small>{[entry.team, entry.sub || entry.sport].filter(Boolean).join(" · ") || "MLB player"}</small>
                  </span>
                  {logo ? <img className="command-player-team" src={logo} alt={`${entry.team || "MLB"} team logo`} /> : <span className="command-player-team-fallback">MLB</span>}
                </CommandPrimitive.Item>
              );
            })}

            {payload.loading && query.trim() ? (
              <div className="command-player-status" role="status"><span />Searching MLB players…</div>
            ) : null}

            {!payload.loading && entries.length === 0 && !showExact ? (
              <div className="command-player-empty">
                <Search size={18} aria-hidden="true" />
                <span>{query.trim() ? "No players found" : "Your recent player searches will appear here"}</span>
              </div>
            ) : null}

            {showExact ? (
              <CommandPrimitive.Item value={`search-${query}`} onSelect={searchExactName} className="command-player-item command-player-exact">
                <span className="command-player-avatar"><Search size={17} aria-hidden="true" /></span>
                <span className="command-player-copy"><strong>Search “{query.trim()}” live</strong><small>{payload.fetchFailed ? "Try the player’s exact name" : "Look up this exact MLB name"}</small></span>
              </CommandPrimitive.Item>
            ) : null}
          </CommandPrimitive.List>
          <div className="command-player-footer"><span>↑↓ Navigate</span><span>Enter Select</span><span>Esc Close</span></div>
        </motion.div>
      </CommandPrimitive>
    </div>
  );
}

export { ActionSearchBar };
