"""NBA v2: fit on train, choose calibration / blend on validation; --test prints the untouched test once."""
import sys, json, numpy as np, pandas as pd
from metrics import report, table, phi, calibration
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.isotonic import IsotonicRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from nba_eval import prep, CUT
df=prep(pd.read_pickle('nba_R0.0.pkl'))
tr=df.season.isin([2024,2025]); va=(df.season==2026)&(df.date<CUT); te=(df.season==2026)&(df.date>=CUT)
MC=['rmargin','lost_d']; TC=['rtotal','lost_s']
mm=make_pipeline(StandardScaler(),Ridge(alpha=30)).fit(df.loc[tr,MC],df.loc[tr,'margin'])
tm=make_pipeline(StandardScaler(),Ridge(alpha=30)).fit(df.loc[tr,TC],df.loc[tr,'total'])
df['pm']=mm.predict(df[MC]); df['pt']=tm.predict(df[TC])
coef=lambda m,c:(dict(zip(c,np.round(m[-1].coef_/m[0].scale_,4))),round(float(m[-1].intercept_-np.sum(m[-1].coef_*m[0].mean_/m[0].scale_)),3))
print('margin model',coef(mm,MC)); print('total model',coef(tm,TC))
V=df[va]; y=(V.margin>0).astype(int)
# calibration: compare on validation by 2-fold (first half of validation fits, second scores, then swap)
def cv(fn):
    idx=np.arange(len(V)); h=len(V)//2; out=np.zeros(len(V))
    for fit_i,score_i in ((idx[:h],idx[h:]),(idx[h:],idx[:h])): out[score_i]=fn(V.pm.values[fit_i],y.values[fit_i],V.pm.values[score_i])
    return out
def normal(sig): return lambda xf,yf,xs: phi(xs/sig)
def logistic(xf,yf,xs): m=LogisticRegression(C=1e6).fit(xf.reshape(-1,1),yf); return m.predict_proba(xs.reshape(-1,1))[:,1]
def iso(xf,yf,xs): m=IsotonicRegression(out_of_bounds='clip',y_min=0.02,y_max=0.98).fit(xf,yf); return m.predict(xs)
rows=[]
for name,fn in (('normal s=11',normal(11)),('normal s=12.5',normal(12.5)),('normal s=14',normal(14)),('logistic',logistic),('isotonic',iso)):
    p=cv(fn); rows.append(report(f'calib {name} | val (2-fold)',V.pm,V.margin,p))
print(table(rows))
cal=LogisticRegression(C=1e6).fit(V.pm.values.reshape(-1,1),y)
a,b=float(cal.intercept_[0]),float(cal.coef_[0][0]); print('logistic calibration on all validation: a=%.4f b=%.4f (b*12.5=%.3f)'%(a,b,b*12.5))
prob=lambda m:1/(1+np.exp(-(a+b*m)))
# blend weights on validation games with a line
L=V[V.mkt.notna()]; rows=[]
for w in (0,0.1,0.2,0.25,0.3,0.4,0.5,0.75,1.0):
    bm=(1-w)*L.mkt+w*L.pm
    rows.append(report(f'blend ours={w:.2f} | val',bm,L.margin,phi(bm/12.5)))
rows.append(report('totals: ours | val',L.pm,L.margin,None,L.pt,L.total)); rows.append(report('totals: line | val',L.mkt,L.margin,None,L.tline,L.total))
print(table(rows))
json.dump({'margin':coef(mm,MC),'total':coef(tm,TC),'calibration':[a,b]},open('nba_v2_params.json','w'))
phi14=lambda m:phi(np.asarray(m)/14.0)
if '--test' in sys.argv:
    T=df[te]; TL=T[T.mkt.notna()]
    v1=pd.read_csv('../gp/v1_replay.csv'); V1=TL[['game','margin']].merge(v1,on='game')
    w=float(sys.argv[sys.argv.index('--test')+1])
    rows=[report('market line | TEST w/ lines',TL.mkt,TL.margin,phi(TL.mkt/12.5),TL.tline,TL.total),
          report('v1 as deployed (fit on 2025-26) | TEST',V1.model,V1.margin,phi(V1.model/12.5),V1.mtotal,V1.actual_total,spread_margin=-V1.spread),
          report('v1 final (75/25) | TEST',V1.final,V1.margin,phi(V1.final/12.5)),
          report('v2 independent | TEST w/ lines',TL.pm,TL.margin,phi14(TL.pm),TL.pt,TL.total,spread_margin=TL.mkt),
          report('v2 independent | TEST all games',T.pm,T.margin,phi14(T.pm),T.pt,T.total)]
    for ww in sorted({0.25,w}):
        bm=(1-ww)*TL.mkt+ww*TL.pm; rows.append(report(f'v2 market-adjusted ours={ww} | TEST',bm,TL.margin,phi14(bm),TL.tline,TL.total))
    print(table(rows)); print(calibration(phi14(T.pm),T.margin))
