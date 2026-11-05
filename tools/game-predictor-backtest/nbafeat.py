"""Walk-forward NBA features: every number for a game uses only games before its date."""
import numpy as np, pandas as pd, pickle, math, sys
from collections import defaultdict
from nbadata import CITY, km
S=pickle.load(open('nba_seasons.pkl','rb'))
TEAMS=sorted(CITY); IDX={t:i for i,t in enumerate(TEAMS)}; N=len(TEAMS)

def solve(rows, w, prior, lam, n=N):
    """eff = mu + hfa*H + o[t] + d[u]  (ridge toward prior o/d); rows: (t,u,H,y)."""
    k=2+2*n
    if len(rows):
        X=np.zeros((len(rows),k)); y=np.array([r[3] for r in rows])
        for i,(t,u,H,_) in enumerate(rows):
            X[i,0]=1; X[i,1]=H; X[i,2+t]=1; X[i,2+n+u]=1
        sw=np.sqrt(w)[:,None]; A=X*sw; b=y*np.sqrt(w)
    else:
        A=np.zeros((0,k)); b=np.zeros(0)
    P=np.zeros((2*n,k)); P[:,2:]=np.eye(2*n)*math.sqrt(lam); pb=np.concatenate([prior[0],prior[1]])*math.sqrt(lam)
    # mu and hfa weakly anchored so an empty season still solves
    Q=np.zeros((2,k)); Q[0,0]=math.sqrt(1e-3); Q[1,1]=math.sqrt(1.0); qb=np.array([prior[2]*math.sqrt(1e-3), prior[3]*1.0])
    x=np.linalg.lstsq(np.vstack([A,P,Q]),np.concatenate([b,pb,qb]),rcond=None)[0]
    return x[0],x[1],x[2:2+n],x[2+n:]

def pace_solve(rows,w,prior,lam,n=N):
    k=1+n
    X=np.zeros((len(rows),k)); y=np.array([r[2] for r in rows]) if rows else np.zeros(0)
    for i,(t,u,_) in enumerate(rows): X[i,0]=1; X[i,1+t]+=1; X[i,1+u]+=1
    sw=np.sqrt(w)[:,None] if rows else np.zeros((0,1))
    A=X*sw if rows else np.zeros((0,k)); b=y*np.sqrt(w) if rows else np.zeros(0)
    P=np.zeros((n,k)); P[:,1:]=np.eye(n)*math.sqrt(lam); pb=prior[0]*math.sqrt(lam)
    Q=np.zeros((1,k)); Q[0,0]=math.sqrt(1e-3); qb=np.array([prior[1]*math.sqrt(1e-3)])
    x=np.linalg.lstsq(np.vstack([A,P,Q]),np.concatenate([b,pb,qb]),rcond=None)[0]
    return x[0],x[1:]

def team_rows(games):
    """Each game twice: (date, t, u, H, eff, poss, game)."""
    out=[]
    for g in games.itertuples():
        h,a=IDX[g.home],IDX[g.away]
        out.append((g.date,h,a,1,100*g.hs/g.poss,g.poss,g.game)); out.append((g.date,a,h,-1,100*g._7/g.poss,g.poss,g.game))
    return out

def final_ratings(year,lam,half,keep,pkeep,prior=None):
    """A season's ratings at its end (the next season's prior)."""
    s=S[year]; rows=team_rows(s['games']); end=max(r[0] for r in rows)
    w=np.array([0.5**(((end-r[0]).days)/half) for r in rows])
    pr=prior or (np.zeros(N),np.zeros(N),112.0,1.5,np.zeros(N),100.0)
    mu,hfa,o,d=solve([(r[1],r[2],r[3],r[4]) for r in rows],w,(pr[0],pr[1],pr[2],pr[3]),lam)
    pm,p=pace_solve([(r[1],r[2],r[5]) for r in rows],w,(pr[4],pr[5]),lam)
    return o*keep,d*keep,mu,hfa,p*pkeep,pm

def build(year,lam=8,half=45,keep=0.6,pkeep=0.75,R=0.0):
    prev=final_ratings(year-1,lam,half,1.0,1.0)
    prior=(prev[0]*keep,prev[1]*keep,prev[2],prev[3],prev[4]*pkeep,prev[5])
    s=S[year]; games=s['games']; rows=team_rows(games); lines=s['lines']
    by_date=defaultdict(list)
    for g in games.itertuples(): by_date[g.date].append(g)
    seq=defaultdict(list)        # team -> [(date, game, home team)]
    last_team={}                 # player -> (date, team) of his latest appearance
    feats=[]; done=[]
    for date in sorted(by_date):
        past=[r for r in rows if r[0]<date]
        w=np.array([0.5**(((date-r[0]).days)/half) for r in past]) if past else np.zeros(0)
        mu,hfa,o,d=solve([(r[1],r[2],r[3],r[4]) for r in past],w,(prior[0],prior[1],prior[2],prior[3]),lam)
        pm,p=pace_solve([(r[1],r[2],r[5]) for r in past],w,(prior[4],prior[5]),lam)
        for g in by_date[date]:
            h,a=IDX[g.home],IDX[g.away]
            poss=pm+p[h]+p[a]
            eh,ea=mu+o[h]+d[a],mu+o[a]+d[h]
            row=dict(game=g.game,date=date,type=g.type,home=g.home,away=g.away,hs=g.hs,as_=g._7,margin=g.hs-g._7,total=g.hs+g._7,
                     poss_pred=poss,poss=g.poss,rmargin=poss*(eh-ea)/100,rtotal=poss*(eh+ea)/100,hfa_r=hfa*poss/100*2,mu=mu,
                     oh=o[h],dh=d[h],oa=o[a],da=d[a],ph=p[h],pa=p[a])
            for side,team,opp in (('h',g.home,g.away),('a',g.away,g.home)):
                hist=seq[team]
                # rest and travel
                if hist:
                    lastd,_,lasthome=hist[-1]
                    rest=(date-lastd).days
                    trav=km(lasthome,g.home)/1000 if rest<=3 else 0.0
                else:
                    rest,trav=5,0.0
                in4=sum(1 for x in hist if (date-x[0]).days<=3)
                row[f'rest_{side}']=min(rest,4); row[f'b2b_{side}']=int(rest==1); row[f'3in4_{side}']=int(in4>=2)
                row[f'trav_{side}']=trav
                row[f'tz_{side}']=abs(CITY[g.home][1]-(CITY[hist[-1][2]][1] if hist else CITY[g.home][1]))/15 if hist and rest<=2 else 0.0
                # who's out (regulars missing tonight, still with this team) and who's back
                tonight={pid for pid,*_ in lines.get((g.game,team),[])}
                recent=hist[-30:]
                if recent:
                    wts=np.array([0.5**(((date-x[0]).days)/half) for x in recent]); W=wts.sum()
                    apps=defaultdict(list)
                    for (gd,gid,_),wt in zip(recent,wts):
                        for pid,mn,gs,pts,reb,ast,pos,name in lines.get((gid,team),[]):
                            apps[pid].append((gd,mn,gs,wt))
                    lost=back=lost_min=0.0; n_out=0
                    for pid,ap in apps.items():
                        if last_team.get(pid,(None,team))[1]!=team: continue      # traded away
                        mins=[x[1] for x in ap[-10:]]; expm=sum(mins)/len(mins)
                        if expm<12 or len(ap)<2: continue
                        totmin=sum(x[1] for x in ap); gsm=(sum(x[2] for x in ap)+R*200)/(totmin+200)    # Game Score a minute, shrunk to replacement
                        val=(gsm-R)*expm
                        reflect=sum(x[3] for x in ap)/W
                        if pid not in tonight: lost+=val*reflect; lost_min+=expm*reflect; n_out+=1
                        else: back+=val*(1-reflect)
                    row[f'lost_{side}']=lost; row[f'back_{side}']=back; row[f'lostmin_{side}']=lost_min; row[f'nout_{side}']=n_out
                else:
                    row[f'lost_{side}']=row[f'back_{side}']=row[f'lostmin_{side}']=0.0; row[f'nout_{side}']=0
                row[f'gp_{side}']=len(hist)
            feats.append(row)
        for g in by_date[date]:
            for team in (g.home,g.away):
                seq[team].append((date,g.game,g.home))
                for pid,*_ in lines.get((g.game,team),[]): last_team[pid]=(date,team)
    return pd.DataFrame(feats)

if __name__=='__main__':
    import itertools, json
    lam,half,keep,pkeep,R=[float(x) for x in sys.argv[1:6]]
    out=pd.concat([build(y,lam,half,keep,pkeep,R).assign(season=y) for y in (2024,2025,2026)])
    out.to_pickle(f'nba_feats_{lam:g}_{half:g}_{keep:g}_{pkeep:g}_{R:g}.pkl'); print(len(out))
