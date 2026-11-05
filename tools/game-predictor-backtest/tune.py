"""Tune the rating system's settings on the training seasons only (2023-24, 2024-25)."""
import itertools, numpy as np, pandas as pd
from multiprocessing import Pool
import nbafeat
def run(args):
    lam,half,keep=args
    df=pd.concat([nbafeat.build(y,lam,half,keep,0.75,0.0) for y in (2024,2025)])
    X=np.column_stack([df.rmargin,np.ones(len(df))]); b=np.linalg.lstsq(X,df.margin,rcond=None)[0]; p=X@b
    Xt=np.column_stack([df.rtotal,np.ones(len(df))]); bt=np.linalg.lstsq(Xt,df.total,rcond=None)[0]
    return (lam,half,keep,round(float(np.mean(np.abs(df.margin-p))),3),round(float(np.mean(np.sign(df.margin)==np.sign(p))),4),round(float(b[0]),3),round(float(np.mean(np.abs(df.total-Xt@bt))),3))
grid=list(itertools.product((4,12,30),(25,50,100,400),(0.5,0.75)))
with Pool(4) as pool: res=pool.map(run,grid)
for r in sorted(res,key=lambda r:r[3])[:12]: print(r)
print('worst',sorted(res,key=lambda r:r[3])[-1])
