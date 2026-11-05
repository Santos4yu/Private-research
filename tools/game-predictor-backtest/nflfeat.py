"""Walk-forward NFL features (2013-2025): every number uses only games before kickoff day."""
import json, math, sys, numpy as np, pandas as pd
from collections import defaultdict
P='../nflpbp/'
ALIAS={'SD':'LAC','STL':'LA','OAK':'LV'}
fix=lambda t:ALIAS.get(t,t)
G=pd.read_csv('../gp/g.csv'); G=G[(G.season>=2012)&(G.season<=2026)].copy()
for c in ('home_team','away_team'): G[c]=G[c].map(fix)
G['date']=pd.to_datetime(G.gameday)
TEAMS=sorted(set(G.home_team)|set(G.away_team)); IDX={t:i for i,t in enumerate(TEAMS)}; N=len(TEAMS)
TG={}; QB=defaultdict(list)
for s in range(2012,2026):
    d=json.load(open(P+f'pbp_{s}.json'))
    for r in d['team']: TG[(r['game'],fix(r['team']),r['side'])]=r
    for r in d['qb']: QB[r['game']].append({**r,'team':fix(r['team'])})

def ridge(rows,w,prior,lam,n=N,home=True):
    """y = mu + hfa*H + a[t] + b[u]; ridge toward prior (a,b)."""
    k=2+2*n; m=len(rows)
    X=np.zeros((m,k)); y=np.zeros(m)
    for i,(t,u,H,v) in enumerate(rows): X[i,0]=1; X[i,1]=H; X[i,2+t]=1; X[i,2+n+u]=1; y[i]=v
    sw=np.sqrt(w)
    A=X*sw[:,None]; b=y*sw
    Pm=np.zeros((2*n,k)); Pm[:,2:]=np.eye(2*n)*math.sqrt(lam); pb=np.concatenate(prior[:2])*math.sqrt(lam)
    Q=np.zeros((2,k)); Q[0,0]=0.03; Q[1,1]=1.0 if home else 100.0; qb=np.array([prior[2]*0.03,prior[3]*(1.0 if home else 100.0)])
    x=np.linalg.lstsq(np.vstack([A,Pm,Q]),np.concatenate([b,pb,qb]),rcond=None)[0]
    return x[0],x[1],x[2:2+n],x[2+n:]

def season_rows(season,upto=None):
    """(date,t,u,H,epa/play,succ,pts,plays,db/play,game) per team-game, both sides, final games only."""
    out=[]
    g=G[(G.season==season)&G.home_score.notna()]
    if upto is not None: g=g[g.date<upto]
    for r in g.itertuples():
        for t,u,H,pts in ((r.home_team,r.away_team,0 if r.location=='Neutral' else 1,r.home_score),(r.away_team,r.home_team,0 if r.location=='Neutral' else -1,r.away_score)):
            x=TG.get((r.game_id,t,'o'))
            if not x or not x['plays']: continue
            out.append((r.date,IDX[t],IDX[u],H,x['epa']/x['plays'],x['succ']/x['plays'],pts,x['plays'],x['db']/x['plays'],r.game_id))
    return out

def rate(rows,date,half,lam,prior):
    w=np.array([0.5**(((date-r[0]).days)/half) for r in rows]) if rows else np.zeros(0)
    res={}
    for key,col in (('epa',4),('succ',5),('pts',6),('plays',7)):
        pr=prior[key]
        res[key]=ridge([(r[1],r[2],r[3],r[col]) for r in rows],w,pr,lam[key] if isinstance(lam,dict) else lam,home=key!='plays')
    return res

def final(season,half,lam,keep):
    rows=season_rows(season); end=max(r[0] for r in rows)+pd.Timedelta(days=1)
    base={'epa':(np.zeros(N),np.zeros(N),0.0,0.02),'succ':(np.zeros(N),np.zeros(N),0.44,0.005),'pts':(np.zeros(N),np.zeros(N),22.0,1.0),'plays':(np.zeros(N),np.zeros(N),62.0,0.0)}
    r=rate(rows,end,half,lam,base)
    return {k:(v[2]*keep,v[3]*keep,v[0],v[1]) for k,v in r.items()}

def qb_values(before_date):
    """QB -> (dropbacks, epa sum) over all games before the date (2012 on)."""
    tot=defaultdict(lambda:[0.0,0.0])
    for gid,date in GAME_DATES.items():
        if date>=before_date: continue
        for q in QB.get(gid,[]): tot[q['qb']][0]+=q['db']; tot[q['qb']][1]+=q['epa']
    return tot
GAME_DATES={r.game_id:r.date for r in G.itertuples()}

def build(season,half=60,lam=6,keep=0.5,qk=250,repl=-0.12):
    prev=final(season-1,half,lam,keep)
    rows_all=season_rows(season)
    games=G[G.season==season].sort_values('date')
    feats=[]
    qbcache={}
    for date,day in games.groupby('date'):
        rows=[r for r in rows_all if r[0]<date]
        rt=rate(rows,date,half,lam,prev)
        if date not in qbcache: qbcache[date]=qb_values(date)
        qv=qbcache[date]
        val=lambda q:(qv[q][1]+repl*qk)/(qv[q][0]+qk) if q in qv else repl
        for r in day.itertuples():
            if pd.isna(r.home_score): continue
            h,a=IDX[r.home_team],IDX[r.away_team]
            neutral=r.location=='Neutral'
            row=dict(game=r.game_id,season=season,week=r.week,type=r.game_type,date=date,home=r.home_team,away=r.away_team,
                     margin=r.home_score-r.away_score,total=r.home_score+r.away_score,spread=-r.spread_line if not pd.isna(r.spread_line) else np.nan,
                     tline=r.total_line,hml=r.home_moneyline,aml=r.away_moneyline,neutral=int(neutral),
                     rest=(r.home_rest-r.away_rest) if not pd.isna(r.home_rest) and not pd.isna(r.away_rest) else 0,
                     wind=r.wind if not pd.isna(r.wind) else 0.0,temp=r.temp if not pd.isna(r.temp) else 60.0,
                     dome=int(str(r.roof) in ('dome','closed')),div=r.div_game)
            for key,(mu,hfa,o,d) in rt.items():
                row[f'{key}_h']=o[h]+d[a]; row[f'{key}_a']=o[a]+d[h]; row[f'{key}_mu']=mu; row[f'{key}_hfa']=hfa
                row[f'{key}_oh'],row[f'{key}_dh'],row[f'{key}_oa'],row[f'{key}_da']=o[h],d[h],o[a],d[a]
            # quarterbacks: tonight's starter against the ones the ratings saw
            for side,team,qid in (('h',r.home_team,r.home_qb_id),('a',r.away_team,r.away_qb_id)):
                seen=defaultdict(float); W=0.0
                for x in rows:
                    if TEAMS[x[1]]!=team: continue
                    wt=0.5**(((date-x[0]).days)/half)
                    for q in QB.get(x[9],[]):
                        if q['team']==team and q['db']>=5: seen[q['qb']]+=wt*q['db']; W+=wt*q['db']
                window=sum(val(q)*v for q,v in seen.items())/W if W else None
                tonight=val(qid) if isinstance(qid,str) else None
                row[f'qb_{side}']=(tonight-window) if tonight is not None and window is not None else 0.0
                row[f'qbnew_{side}']=int(isinstance(qid,str) and W>0 and seen.get(qid,0)/W<0.2)
                row[f'qbval_{side}']=tonight if tonight is not None else repl
                # how many plays the team runs a game, for scaling
            feats.append(row)
    return pd.DataFrame(feats)

if __name__=='__main__':
    seasons=[int(x) for x in sys.argv[1:]] or list(range(2013,2026))
    from multiprocessing import Pool
    with Pool(2) as pool: parts=pool.map(build,seasons)
    df=pd.concat(parts); df.to_pickle('nfl_feats.pkl'); print(len(df),df.season.value_counts().sort_index().to_dict())
