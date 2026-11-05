"""Scoring a set of predictions: winners, Brier, log loss, margin and total MAE, against the spread, calibration."""
import numpy as np, pandas as pd
from math import erf, sqrt
phi=np.vectorize(lambda x:0.5*(1+erf(x/sqrt(2))))
def report(name,margin,actual,prob=None,total=None,actual_total=None,spread_margin=None,decided=None):
    m=np.asarray(margin,float); y=np.asarray(actual,float)
    keep=y!=0 if decided is None else decided
    out={'model':name,'n':int(len(m)),'win%':round(float(np.mean(np.sign(m[keep])==np.sign(y[keep])))*100,1),'marginMAE':round(float(np.mean(np.abs(y-m))),2)}
    if prob is not None:
        p=np.clip(np.asarray(prob,float),1e-4,1-1e-4); o=(y>0).astype(float)
        out['brier']=round(float(np.mean((p[keep]-o[keep])**2)),4)
        out['logloss']=round(float(-np.mean(o[keep]*np.log(p[keep])+(1-o[keep])*np.log(1-p[keep]))),4)
    if total is not None and actual_total is not None:
        t=np.asarray(total,float); at=np.asarray(actual_total,float); ok=~np.isnan(t)
        out['totalMAE']=round(float(np.mean(np.abs(at[ok]-t[ok]))),2)
    if spread_margin is not None:
        s=np.asarray(spread_margin,float); ok=~np.isnan(s)&(y-s!=0)&(m-s!=0)
        out['ATS%']=round(float(np.mean(np.sign(m[ok]-s[ok])==np.sign(y[ok]-s[ok])))*100,1); out['ATSn']=int(ok.sum())
    return out
def calibration(prob,actual,bins=(0,.1,.2,.3,.4,.5,.6,.7,.8,.9,1)):
    p=np.asarray(prob,float); o=(np.asarray(actual,float)>0).astype(float)
    df=pd.DataFrame({'p':p,'o':o}); df['bin']=pd.cut(df.p,bins,include_lowest=True)
    return df.groupby('bin',observed=True).agg(n=('o','size'),predicted=('p','mean'),won=('o','mean')).round(3)
def table(rows):
    return pd.DataFrame(rows).to_string(index=False)
