// A previous prop's response, disabled model or unavailable result cannot display a number.
export function projectionValue(data, propKey) {
  return data?.propType === propKey && data.status !== 'NOT_AVAILABLE'
    && ['EXPERIMENTAL', 'VALIDATED'].includes(data.promotion) && Number.isFinite(data.projectionMean)
    ? data.projectionMean : null;
}
