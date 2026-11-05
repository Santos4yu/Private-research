"""NFL v2: fit on 2013-21, choose on 2022-23, --test reads 2024-25 once."""
import sys, json, numpy as np, pandas as pd
from metrics import report, table, phi, calibration
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.isotonic import IsotonicRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from scipy.optimize import minimize_scalar
from nfl_tune import prep
df=prep(pd.read_pickle('nfl_feats.pkl'))
df['mkt']=-df.spread
v1=pd.read_pickle('../gp/nfl.pkl'); _fix={'SD':'LAC','STL':'LA','OAK':'LV'}
v1['home']=v1.home.map(lambda t:_fix.get(t,t)); v1['away']=v1.away.map(lambda t:_fix.get(t,t))
df=df.merge(v1[['season','week','home','away','netd','qbh','qba']],on=['season','week','home','away'],how='left'); df['v1qb']=df.qba-df.qbh
df['pts_s']=df.pts_h+df.pts_a; df['epa_s']=df.epa_h+df.epa_a; df['succ_s']=df.succ_h+df.succ_a
df['plays_s']=df.plays_h+df.plays_a; df['windy']=np.where(df.dome==1,0,np.clip(df.wind-10,0,None)); df['cold']=np.where(df.dome==1,0,np.clip(40-df.temp,0,None))
df['qbv_s']=df.qbval_h+df.qbval_a
tr=df.season<=2021; va=df.season.isin([2022,2023]); te=df.season>=2024
MC=['epa_d','succ_d','pts_d','home1','rest','qb_d','qbnew_d']; TC=['pts_s','epa_s','succ_s','plays_s','windy','cold','dome','qbv_s']
def mk(alpha): return make_pipeline(StandardScaler(),Ridge(alpha=alpha))
rows=[]
for alpha in (30,100,300,1000):
    m=mk(alpha).fit(df.loc[tr,MC],df.loc[tr,'margin']); p=m.predict(df.loc[va,MC])
    rows.append(report(f'margin alpha={alpha} | val',p,df.loc[va,'margin']))
    t=mk(alpha).fit(df.loc[tr,TC],df.loc[tr,'total']); pt=t.predict(df.loc[va,TC])
    rows[-1]['totalMAE']=round(float(np.mean(np.abs(df.loc[va,'total']-pt))),2)
print(table(rows))
ALPHA=float(sys.argv[sys.argv.index('--alpha')+1]) if '--alpha' in sys.argv else 300
mm=mk(ALPHA).fit(df.loc[tr,MC],df.loc[tr,'margin']); tm=mk(ALPHA).fit(df.loc[tr,TC],df.loc[tr,'total'])
coef=lambda m,c:(dict(zip(c,np.round(m[-1].coef_/m[0].scale_,4))),round(float(m[-1].intercept_-np.sum(m[-1].coef_*m[0].mean_/m[0].scale_)),3))
print('margin',coef(mm,MC)); print('total',coef(tm,TC))
df['pm']=mm.predict(df[MC]); df['pt']=tm.predict(df[TC])
# out-of-fold predictions on train (leave one season out) for calibration
oof=np.zeros(tr.sum()); T=df[tr]
for s in sorted(T.season.unique()):
    f=T.season!=s; m=mk(ALPHA).fit(T.loc[f,MC],T.loc[f,'margin']); oof[(T.season==s).values]=m.predict(T.loc[~f,MC])
yo=(T.margin>0).astype(int).values; keep=T.margin.values!=0
def nll(sig,m,y):
    p=np.clip(phi(m/sig),1e-6,1-1e-6); return -np.mean(np.where(y>0,np.log(p),np.log(1-p)))
sig=minimize_scalar(lambda s:nll(s,oof[keep],T.margin.values[keep]),bounds=(8,25),method='bounded').x
lr=LogisticRegression(C=1e6).fit(oof[keep].reshape(-1,1),yo[keep]); iso=IsotonicRegression(out_of_bounds='clip',y_min=0.02,y_max=0.98).fit(oof[keep],yo[keep])
V=df[va&(df.margin!=0)]
print('sigma(oof train)=%.2f'%sig)
rows=[report('calib normal | val',V.pm,V.margin,phi(V.pm/sig)),report('calib logistic | val',V.pm,V.margin,lr.predict_proba(V.pm.values.reshape(-1,1))[:,1]),
      report('calib isotonic | val',V.pm,V.margin,iso.predict(V.pm.values))]
L=V[V.mkt.notna()]
sm=minimize_scalar(lambda s:nll(s,L.mkt.values,L.margin.values),bounds=(8,25),method='bounded').x
for w in (0,0.05,0.1,0.15,0.2,0.3,0.5):
    bm=(1-w)*L.mkt+w*L.pm; rows.append(report(f'blend ours={w:.2f} | val',bm,L.margin,phi(bm/sm)))
rows.append(report('totals ours | val',L.pm,L.margin,None,L.pt,L.total)); rows.append(report('totals line | val',L.mkt,L.margin,None,L.tline,L.total))
print(table(rows)); print('market sigma(val)=%.2f'%sm)
rng=np.random.default_rng(1); y=L.margin.values
a=np.abs(y-(0.9*L.mkt+0.1*L.pm).values)
for w in (0.0,0.2,0.3):
    b=np.abs(y-((1-w)*L.mkt+w*L.pm).values); d=[np.mean((a-b)[i]) for i in [rng.integers(0,len(y),len(y)) for _ in range(3000)]]
    print('MAE(w=.10)-MAE(w=%.2f): %.3f [%.3f, %.3f]'%(w,np.mean(a-b),np.percentile(d,2.5),np.percentile(d,97.5)))
json.dump({'margin':coef(mm,MC),'total':coef(tm,TC),'sigma':sig,'market_sigma':sm,'alpha':ALPHA},open('nfl_v2_params.json','w'))
if '--test' in sys.argv:
    W=float(sys.argv[sys.argv.index('--test')+1])
    Te=df[te&(df.margin!=0)]; TL=Te[Te.mkt.notna()]
    v1=TL.dropna(subset=['netd'])
    rows=[report('market line | TEST',TL.mkt,TL.margin,phi(TL.mkt/sm),TL.tline,TL.total),
          report('v1 as deployed | TEST',1.533*v1.netd+2.114+3.1*v1.v1qb+0.118*v1.rest.clip(-7,7),v1.margin,phi((1.533*v1.netd+2.114+3.1*v1.v1qb+0.118*v1.rest.clip(-7,7))/12)),
          report('v2 independent | TEST',TL.pm,TL.margin,phi(TL.pm/sig),TL.pt,TL.total,spread_margin=TL.mkt)]
    for w in sorted({0.1,W}):
        bm=(1-w)*TL.mkt+w*TL.pm; rows.append(report(f'v2 market-adjusted ours={w} | TEST',bm,TL.margin,phi(bm/sm),TL.tline,TL.total))
    print(table(rows)); print(calibration(phi(Te.pm/sig),Te.margin))
    # moneyline value bets: independent calibrated chance vs no-vig market, at the offered price
    M=TL.dropna(subset=['hml','aml']).copy()
    imp=lambda ml:np.where(ml<0,-ml/(-ml+100),100/(ml+100))
    ph,pa=imp(M.hml),imp(M.aml); M['mh']=ph/(ph+pa)
    for label,pfun in (('independent',lambda d:phi(d.pm/sig)),('market-adjusted',lambda d:phi(((1-W)*d.mkt+W*d.pm)/sm))):
        p=pfun(M); dec_h=np.where(M.hml>0,1+M.hml/100,1+100/np.abs(M.hml)); dec_a=np.where(M.aml>0,1+M.aml/100,1+100/np.abs(M.aml))
        ev_h=p*dec_h-1; ev_a=(1-p)*dec_a-1
        for thr in (0.0,0.03,0.06):
            bets=[]
            for i in range(len(M)):
                if ev_h[i]>thr and ev_h[i]>=ev_a[i]: bets.append(dec_h[i]-1 if M.margin.iloc[i]>0 else -1)
                elif ev_a[i]>thr: bets.append(dec_a[i]-1 if M.margin.iloc[i]<0 else -1)
            bets=np.array(bets)
            print(f'EV>{thr:.2f} {label}: {len(bets)} bets, won {np.mean(bets>0)*100:.1f}%, ROI {bets.mean()*100 if len(bets) else 0:+.1f}% (1 unit each)')
