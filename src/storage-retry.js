// Only trusted storage failure codes trigger a longer automatic retry pause.
const STORAGE_CODES=new Set(['storage_capacity','storage_access_rejected','storage_unavailable','storage_not_configured','storage_migration_pending']);
export function serviceRequestError(payload={},retryHeader){
 const error=new Error(payload.error||'Request unavailable');
 if(STORAGE_CODES.has(payload.code)){
  error.code=payload.code;
  const seconds=Number(payload.retryAfter??retryHeader);
  error.retryAfter=Number.isFinite(seconds)&&seconds>0?Math.min(300,Math.ceil(seconds)):15;
 }
 return error;
}
