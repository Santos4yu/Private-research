import React, { useEffect, useState } from 'react';

// Both layouts use the same live validation and export workflow (app.js):
// PrizePicks opens in a new tab or its app, never in place of this page,
// and the link can be copied instead.
export function MobileSlipActions() {
  const [builder, setBuilder] = useState({ status: 'Add at least 2 props to export.', canExport: false, busy: false, link: '' });
  useEffect(() => {
    const sync = ({ detail }) => setBuilder((current) => ({ ...current, ...detail }));
    window.addEventListener('vortex:prop-builder-sync', sync);
    window.dispatchEvent(new Event('vortex:prop-builder-ready'));
    return () => window.removeEventListener('vortex:prop-builder-sync', sync);
  }, []);
  return <section className="mobile-slip-actions" aria-label="Export your slip">
    <p role="status">{builder.status}</p>
    {builder.link && !builder.busy
      ? <a className="mobile-slip-open" href={builder.link} target="_blank" rel="noopener noreferrer">Open in PrizePicks</a>
      : <button type="button" disabled={!builder.canExport || builder.busy}
        onClick={() => window.dispatchEvent(new Event('vortex:prop-builder-export'))}>
        {builder.busy ? 'Checking lines…' : 'Export to PrizePicks'}
      </button>}
    <button type="button" className="mobile-slip-copy" disabled={!builder.canExport || builder.busy}
      onClick={() => window.dispatchEvent(new Event('vortex:prop-builder-copy'))}>Copy link</button>
    <small>Lines are rechecked before PrizePicks opens. Review and submit your slip there.</small>
  </section>;
}
