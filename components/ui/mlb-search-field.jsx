import React from 'react';

// This is the MLB research search markup from index.html, shared verbatim by
// the React sport surfaces so every primary player search uses one control.
export function MLBSearchField({ id, value, onChange, onKeyDown, onFocus, placeholder = 'Search a player', ariaLabel = 'Search players', expanded, controls, activeDescendant, className = '', children }) {
  return <div className={`search-wrap nfl-shared-search ${className}`.trim()}>
    <div className="search-beam">
      <div className="search-box">
        <input
          className="search-input"
          type="search"
          id={id}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
          enterKeyHint="search"
          aria-label={ariaLabel}
          role={controls ? 'combobox' : undefined}
          aria-autocomplete={controls ? 'list' : undefined}
          aria-expanded={controls ? expanded : undefined}
          aria-controls={controls}
          aria-activedescendant={activeDescendant}
        />
        <button className="lab-search-submit" type="button" aria-label={ariaLabel} onClick={() => document.getElementById(id)?.focus()}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
      </div>
    </div>
    {children}
  </div>;
}
