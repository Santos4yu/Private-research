import {useEffect, useRef, useState} from 'react';

// Asking out loud instead of typing, where the browser can listen (Chrome,
// Edge, and Safari on iPhone and Mac). The words show in the field as
// they're heard; when the speaker stops, what was said is handed back.
//
// One listening session at a time for the whole page, on one recognizer
// started again session after session (Safari on iPhone tends to stop
// listening once a page has made a second one). Safari on iPhone also keeps
// listening after the speaker stops and doesn't always say when it has
// finished, so every session ends on its own clock too: a short pause after
// the last word, a few seconds with nothing heard, and a longest time.

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition || null : null;

export const canListen = Boolean(Recognition);

export const QUIET_MS = 1400;
const NOTHING_MS = 8000;
const LONGEST_MS = 20000;
// After asking it to stop, how long to wait for the browser to say it has.
const SETTLE_MS = 600;

let shared = null;
let current = null;
// The last session ended without the browser saying so: an end from it may
// still arrive, so the next one doesn't take an end before it has started.
let unsettled = false;

function prepare(recognition, session, lang) {
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  const early = () => session.wary && !session.live && Date.now() - session.at < 700;
  recognition.onstart = () => { session.live = true; };
  recognition.onaudiostart = recognition.onstart;
  recognition.onresult = event => {
    if (session.done || early()) return;
    session.live = true;
    session.heard = Array.from(event.results).map(result => result[0]?.transcript || '').join('').replace(/\s+/g, ' ').trim();
    session.onWords(session.heard);
    // A pause after the last word: done.
    if (session.heard) session.later('quiet', QUIET_MS, session.stop);
  };
  recognition.onerror = event => { session.error = event?.error || 'error'; };
  recognition.onend = () => {
    if (early()) return;
    session.ended = true;
    session.finish(true);
  };
}

/**
 * Start listening. `onWords(text)` as the words come in; `onEnd(text)` once,
 * with everything heard (null when it was called off). Returns the session
 * ({stop, cancel}), or null when the browser wouldn't start.
 */
export function listen({lang = 'en-US', onWords = () => {}, onEnd = () => {}} = {}) {
  if (!Recognition) return null;
  // One left listening (from the other button, or one that never finished): let it go quietly.
  current?.cancel();
  const timers = new Map();
  const session = {heard: '', at: Date.now(), wary: unsettled, live: false, ended: false, done: false, error: null, onWords};
  session.later = (name, ms, run) => {
    clearTimeout(timers.get(name));
    timers.set(name, setTimeout(run, ms));
  };
  session.finish = deliver => {
    if (session.done) return;
    session.done = true;
    timers.forEach(clearTimeout);
    timers.clear();
    if (current === session) current = null;
    unsettled = !session.ended;
    if (!session.ended) { try { session.recognition?.abort(); } catch { /* already stopped */ } }
    onEnd(deliver ? session.heard : null);
  };
  session.stop = () => {
    if (session.done) return;
    try { session.recognition.stop(); } catch { /* not running */ }
    session.later('settle', SETTLE_MS, () => session.finish(true));
  };
  session.cancel = () => session.finish(false);

  let recognition = shared || (shared = new Recognition());
  prepare(recognition, session, lang);
  try {
    recognition.start();
  } catch {
    // Still busy with the last session: a new recognizer.
    try { recognition.abort(); } catch { /* not running */ }
    recognition = shared = new Recognition();
    session.wary = false;
    prepare(recognition, session, lang);
    try { recognition.start(); } catch { session.done = true; return null; }
  }
  session.recognition = recognition;
  current = session;
  session.later('nothing', NOTHING_MS, () => { if (!session.heard) session.stop(); });
  session.later('longest', LONGEST_MS, session.stop);
  return session;
}

/**
 * `onWords(text)` as the words come in, `onSaid(text)` once they stop
 * (with everything heard; empty when nothing was). Returns whether it's
 * listening, and start/stop.
 */
export function useVoice({onWords, onSaid, lang = 'en-US'} = {}) {
  const [listening, setListening] = useState(false);
  const mine = useRef(null);
  const alive = useRef(true);
  const handlers = useRef({onWords, onSaid});
  handlers.current = {onWords, onSaid};
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; mine.current?.cancel(); };
  }, []);

  const stop = () => mine.current?.stop();
  const start = () => {
    if (mine.current) return;
    const session = listen({
      lang,
      onWords: text => { if (alive.current) handlers.current.onWords?.(text); },
      onEnd: text => {
        if (mine.current === session) mine.current = null;
        if (!alive.current) return;
        setListening(false);
        if (text !== null) handlers.current.onSaid?.(text);
      },
    });
    if (!session) return;
    mine.current = session;
    setListening(true);
  };
  return {listening, start, stop, supported: canListen};
}
