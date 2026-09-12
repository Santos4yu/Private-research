"""Future offline calibration artifact port. No production curve exists.

Logistic, beta and isotonic transforms consume explicitly supplied artifacts;
this module never fits fabricated betting observations or promotes a curve.
"""
import math
from datetime import datetime
from .distributions import finite

def transform(probability,artifact,evaluation_timestamp):
    if not finite(probability) or not 0<=probability<=1:raise ValueError('Invalid probability')
    if not artifact or artifact.get('lineDataStatus')!='REAL_TIMESTAMPED_LINES':return None
    if artifact.get('status') not in ('EXPERIMENTAL','VALIDATED') or artifact.get('sample',0)<500:return None
    cutoff=datetime.fromisoformat(artifact['fitCutoff']);evaluation=datetime.fromisoformat(evaluation_timestamp)
    if cutoff.tzinfo is None or evaluation.tzinfo is None or cutoff>=evaluation:
        raise ValueError('Calibration must precede evaluated observations')
    p=max(1e-9,min(1-1e-9,probability));method=artifact.get('method')
    if method in ('logistic','beta'):
        coefficients=artifact.get('coefficients',[])
        expected=2 if method=='logistic' else 3
        if len(coefficients)!=expected or not all(finite(v) for v in coefficients):raise ValueError('Invalid coefficients')
        z=coefficients[0]+coefficients[1]*math.log(p/(1-p)) if method=='logistic' else coefficients[0]+coefficients[1]*math.log(p)+coefficients[2]*math.log(1-p)
        return 1/(1+math.exp(-max(-700,min(700,z))))
    if method=='isotonic':
        knots=artifact.get('knots',[])
        if not knots or any(len(k)!=2 or not all(finite(v) and 0<=v<=1 for v in k) for k in knots):raise ValueError('Invalid knots')
        if any(a[0]>=b[0] or a[1]>b[1] for a,b in zip(knots,knots[1:])):raise ValueError('Nonmonotonic knots')
        if p<=knots[0][0]:return knots[0][1]
        for a,b in zip(knots,knots[1:]):
            if p<=b[0]:return a[1]+(b[1]-a[1])*(p-a[0])/(b[0]-a[0])
        return knots[-1][1]
    raise ValueError('Unknown calibration method')
