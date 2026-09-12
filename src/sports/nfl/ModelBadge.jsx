import React from 'react';
export function ModelBadge({ status = 'NOT_AVAILABLE' }) {
  const known = ['PRODUCTION_READY', 'SHADOW_ONLY', 'EXPERIMENTAL', 'DISABLED', 'NOT_AVAILABLE'];
  const value = known.includes(status) ? status : 'NOT_AVAILABLE';
  return <span className={`nfl-model-badge ${value.toLowerCase()}`}>{value.replaceAll('_', ' ')}</span>;
}
