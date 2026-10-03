import {useEffect, useRef, useState} from 'react';

// Asking out loud instead of typing, where the browser can listen (Chrome,
// Edge, and Safari on iPhone and Mac). The words show in the field as
// they're heard; when the speaker stops, what was said is handed back.

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition || null : null;

export const canListen = Boolean(Recognition);

/**
 * `onWords(text)` as the words come in, `onSaid(text)` once they stop
 * (with everything heard; empty when nothing was). Returns whether it's
 * listening, and start/stop.
 */
export function useVoice({onWords, onSaid, lang = 'en-US'} = {}) {
  const [listening, setListening] = useState(false);
  const active = useRef(null);
  const handlers = useRef({onWords, onSaid});
  handlers.current = {onWords, onSaid};
  useEffect(() => () => active.current?.abort?.(), []);

  const stop = () => active.current?.stop?.();
  const start = () => {
    if (!Recognition || active.current) return;
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let heard = '';
    recognition.onresult = event => {
      heard = Array.from(event.results).map(result => result[0]?.transcript || '').join('').replace(/\s+/g, ' ').trim();
      handlers.current.onWords?.(heard);
    };
    recognition.onerror = () => { heard = heard || ''; };
    recognition.onend = () => {
      active.current = null;
      setListening(false);
      handlers.current.onSaid?.(heard);
    };
    active.current = recognition;
    setListening(true);
    try { recognition.start(); } catch { active.current = null; setListening(false); }
  };
  return {listening, start, stop, supported: canListen};
}
