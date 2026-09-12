"""Observed errors and conservative safety alarms; no invented live health."""
from statistics import mean,median,pstdev
from math import sqrt
from ..distributions import finite

def metrics(rows):
    usable=[r for r in rows if finite(r.get('projection')) and finite(r.get('actual'))]
    errors=[r['projection']-r['actual'] for r in usable]
    return {'predictions':len(rows),'eligiblePredictions':len(usable),'MAE':mean(abs(e) for e in errors) if errors else None,
            'MedianAE':median(abs(e) for e in errors) if errors else None,'RMSE':sqrt(mean(e*e for e in errors)) if errors else None,
            'bias':mean(errors) if errors else None,'errorStandardDeviation':pstdev(errors) if len(errors)>1 else None,
            'availability':sum(finite(r.get('projection')) for r in rows)/len(rows) if rows else None,
            'pendingResults':sum(r.get('actual') is None for r in rows),
            'calibrationStatus':'NOT_AVAILABLE'}

def model_health(rows,baseline_mae,current_version,rules,source_changed=False,features_changed=False,reference_coverage=None):
    # Requires an as-of timestamp; ordering is stable, never outcome order.
    own=sorted([r for r in rows if r.get('modelVersion')==current_version],key=lambda r:r['createdAt'])
    snapshots=len(own);distinct={}
    for r in own:
        identity=tuple(r.get(k) for k in ('gameId','playerId','propType'))
        key=identity if all(identity) else (r['createdAt'],)
        distinct[key]=r
    own=sorted(distinct.values(),key=lambda r:r['createdAt'])
    windows={f'last{n}':metrics(own[-n:]) for n in (50,100)}
    years=sorted({r.get('season') for r in own if isinstance(r.get('season'),int)})
    for year in years[-2:]:windows[f'season{year}']=metrics([r for r in own if r.get('season')==year])
    reasons=[];state='HEALTHY';recent=windows['last50']
    if recent['eligiblePredictions']<rules['driftMinimumSample'] or not finite(baseline_mae) or baseline_mae<=0:
        state='WATCH';reasons.append('Insufficient prospective error evidence or reference baseline')
    else:
        ratio=recent['MAE']/baseline_mae
        if ratio>=rules['driftMAERatioDegraded'] or abs(recent['bias'])/baseline_mae>=rules['driftBiasOverBaselineDegraded']:
            state='DEGRADED';reasons.append('Rolling error or bias crossed safety gate')
        elif ratio>=rules['driftMAERatioWatch']:
            state='WATCH';reasons.append('Rolling error rising')
    if source_changed or features_changed:
        state='DEGRADED';reasons.append('Unreviewed source/schema or feature availability change')
    coverage={}
    settled=[r for r in own[-100:] if finite(r.get('actual')) and isinstance((r.get('distribution') or {}).get('percentiles'),dict)]
    if len(settled)>=rules['driftMinimumSample']:
        for p in (10,25,50,75,90):
            valid=[r for r in settled if finite(r['distribution']['percentiles'].get(f'p{p}'))]
            coverage[f'p{p}']=sum(r['actual']<=r['distribution']['percentiles'][f'p{p}'] for r in valid)/len(valid) if valid else None
        if reference_coverage and any(finite(v) and finite(reference_coverage.get(k)) and abs(v-reference_coverage[k])>.15 for k,v in coverage.items()):
            state='DEGRADED';reasons.append('Distribution coverage shifted materially from reviewed historical reference')
    return {'status':state,'storedSnapshots':snapshots,'distinctForecasts':len(own),'windows':windows,'coverage':coverage,'reasons':reasons,'verdictsEnabled':state=='HEALTHY'}
