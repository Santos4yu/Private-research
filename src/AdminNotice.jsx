import React from 'react';
import {useIsAdmin,QUIET} from './admin-notice.js';

/** A part of the page that couldn't load: what went wrong and a Retry for
 * an admin, a calm line (`quiet`) for everyone else (admin-notice.js). */
export function Failure({children,onRetry,quiet=QUIET,className='mlb-context-note'}){
 const admin=useIsAdmin();
 return <p className={className} role="status">{admin?<>{children}{onRetry&&<> <button type="button" onClick={onRetry}>Retry</button></>}</>:quiet}</p>;
}
