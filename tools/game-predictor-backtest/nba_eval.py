"""NBA: fit on 2023-24 + 2024-25, choose on 2025-26 before Jan 15 (validation). The test half is not read here."""
import numpy as np, pandas as pd, sys
from metrics import report, table, phi
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
odds=pd.read_csv('../nbabt/odds.csv').rename(columns={'event':'game'})
CUT=pd.Timestamp('2026-01-15').date()
def prep(df):
    df=df.merge(odds[['game','home_spread','total']].rename(columns={'total':'tline'}),on='game',how='left')
    df['mkt']=-df.home_spread
    for k in ('b2b','3in4','trav','tz','lost','back','lostmin'): df[f'{k}_d']=df[f'{k}_a']-df[f'{k}_h'] if k in ('b2b','3in4','trav','tz','lost','lostmin') else df[f'{k}_h']-df[f'{k}_a']
    df['rest_d']=df.rest_h.clip(0,3)-df.rest_a.clip(0,3)
    df['lost_s']=df.lost_h+df.lost_a
    return df
SETS={'ratings only':['rmargin'],
      '+rest/travel':['rmargin','b2b_d','3in4_d','rest_d','trav_d','tz_d'],
      '+injuries':['rmargin','lost_d','back_d'],
      'full':['rmargin','b2b_d','3in4_d','rest_d','trav_d','tz_d','lost_d','back_d']}
if __name__=='__main__':
    rows=[]; coefs={}
    
    for R in sys.argv[1:] or ['0.0','0.25','0.4']:
        df=prep(pd.read_pickle(f'nba_R{R}.pkl'))
        tr=df.season.isin([2024,2025]); va=(df.season==2026)&(df.date<CUT)
        d=df[va]
        if R==(sys.argv[1:] or ['0.0'])[0]:
            dm=d[d.mkt.notna()]
            rows.append(report('market line | val',dm.mkt,dm.margin,phi(dm.mkt/12.5),dm.tline,dm.total))
        for name,cols in SETS.items():
            if R!='0.0' and 'lost_d' not in cols: continue
            for alpha in (1,30):
                m=make_pipeline(StandardScaler(),Ridge(alpha=alpha)).fit(df.loc[tr,cols],df.loc[tr,'margin'])
                p=m.predict(d[cols])
                rows.append(report(f'R={R} {name} a={alpha} | val',p,d.margin,phi(p/12.5),spread_margin=d.mkt))
                coefs[(R,name,alpha)]=(dict(zip(cols,np.round(m[-1].coef_/m[0].scale_,3))),round(float(m[-1].intercept_-np.sum(m[-1].coef_*m[0].mean_/m[0].scale_)),3))
    print(table(rows))
    for k,v in coefs.items():
        if k[1]=='full' and k[2]==30: print(k,v)
