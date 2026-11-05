"""NFL: tune rating settings and the margin model on validation (2022-23) only. The test seasons are not read."""
import itertools, sys, numpy as np, pandas as pd
from multiprocessing import Pool
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
import nflfeat
COLS=['epa_d','succ_d','pts_d','home1','rest','qb_d','qbnew_d']
def prep(df):
    df=df.copy(); df['home1']=1-df.neutral
    df['epa_d']=df.epa_h-df.epa_a; df['succ_d']=df.succ_h-df.succ_a; df['pts_d']=df.pts_h-df.pts_a
    df['qb_d']=df.qb_h-df.qb_a; df['qbnew_d']=df.qbnew_h-df.qbnew_a
    return df
def run(args):
    half,lam,keep,qk=args
    df=prep(pd.concat([nflfeat.build(s,half,lam,keep,qk) for s in range(2013,2024)]))
    tr=df.season<=2021; va=df.season.isin([2022,2023])
    best=None
    for alpha in (1,10,100):
        m=make_pipeline(StandardScaler(),Ridge(alpha=alpha)).fit(df.loc[tr,COLS],df.loc[tr,'margin'])
        p=m.predict(df.loc[va,COLS]); mae=float(np.mean(np.abs(df.loc[va,'margin']-p)))
        if best is None or mae<best[0]: best=(mae,alpha)
    return (half,lam,keep,qk,round(best[0],3),best[1])
if __name__=='__main__':
    grid=list(itertools.product((40,90,250),(3,8,20),(0.4,0.6),(150,300)))
    with Pool(4) as pool: res=pool.map(run,grid)
    for r in sorted(res,key=lambda r:r[4])[:10]: print(r)
    print('worst',max(res,key=lambda r:r[4]))
