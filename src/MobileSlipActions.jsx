import React, { useEffect, useState } from 'react';

// Both layouts use the same live validation and export workflow.
export function MobileSlipActions() {
  const [builder, setBuilder] = useState({ status: 'Add at least 2 props to export.', canExport: false, busy: false });
  useEffect(() => {
    const sync = ({ detail }) => setBuilder((current) => ({ ...current, ...detail }));
    window.addEventListener('vortex:prop-builder-sync', sync);
    window.dispatchEvent(new Event('vortex:prop-builder-ready'));
    return () => window.removeEventListener('vortex:prop-builder-sync', sync);
  }, []);
  return <section className="mobile-slip-actions" aria-label="Export your slip">
    <p role="status">{builder.status}</p>
    <button type="button" disabled={!builder.canExport || builder.busy}
      onClick={() => window.dispatchEvent(new Event('vortex:prop-builder-export'))}>
      {builder.busy ? 'Checking lines…' : 'Export to PrizePicks'}
    </button>
    <small>Lines are rechecked before PrizePicks opens. Review and submit your slip there.</small>
  </section>;
}
