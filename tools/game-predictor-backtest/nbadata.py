"""NBA seasons as game tables for the walk-forward backtest (sportsdataverse ESPN boxes)."""
import pandas as pd, numpy as np, pickle, math
from collections import defaultdict
D='../nba/'
CITY={'ATL':(33.757,-84.396),'BOS':(42.366,-71.062),'BKN':(40.683,-73.976),'CHA':(35.225,-80.839),'CHI':(41.881,-87.674),
 'CLE':(41.496,-81.688),'DAL':(32.790,-96.810),'DEN':(39.749,-105.008),'DET':(42.341,-83.055),'GS':(37.768,-122.388),
 'HOU':(29.751,-95.362),'IND':(39.764,-86.155),'LAC':(33.945,-118.341),'LAL':(34.043,-118.267),'MEM':(35.138,-90.051),
 'MIA':(25.781,-80.188),'MIL':(43.045,-87.917),'MIN':(44.980,-93.276),'NO':(29.949,-90.082),'NY':(40.751,-73.993),
 'OKC':(35.463,-97.515),'ORL':(28.539,-81.384),'PHI':(39.901,-75.172),'PHX':(33.446,-112.071),'POR':(45.532,-122.667),
 'SAC':(38.580,-121.500),'SA':(29.427,-98.437),'TOR':(43.643,-79.379),'UTAH':(40.768,-111.901),'WSH':(38.898,-77.021)}
def km(a,b):
    (la1,lo1),(la2,lo2)=CITY[a],CITY[b]
    p=math.pi/180; h=math.sin((la2-la1)*p/2)**2+math.cos(la1*p)*math.cos(la2*p)*math.sin((lo2-lo1)*p/2)**2
    return 12742*math.asin(math.sqrt(h))
def season(year):
    t=pd.read_csv(D+f'team_box_{year}.csv')
    t=t[t.season_type.isin([2,3])&t.team_abbreviation.isin(CITY)&t.opponent_team_abbreviation.isin(CITY)].copy()
    t=t.drop_duplicates(['game_id','team_abbreviation'])
    tov=t['total_turnovers'] if 'total_turnovers' in t else t['turnovers']
    t['trips']=t.field_goals_attempted-t.offensive_rebounds+tov.fillna(t['turnovers'])+0.44*t.free_throws_attempted
    g=t.merge(t[['game_id','team_abbreviation','trips']].rename(columns={'team_abbreviation':'opponent_team_abbreviation','trips':'opp_trips'}),on=['game_id','opponent_team_abbreviation'])
    g['poss']=(g.trips+g.opp_trips)/2
    g['date']=pd.to_datetime(g.game_date).dt.date
    home=g[g.team_home_away=='home'][['game_id','date','season_type','team_abbreviation','opponent_team_abbreviation','team_score','opponent_team_score','poss']]
    home.columns=['game','date','type','home','away','hs','as','poss']
    home=home[home.hs.notna()&home['as'].notna()&(home.poss>50)].sort_values(['date','game']).reset_index(drop=True)
    p=pd.read_csv(D+f'player_box_{year}.csv',usecols=['game_id','athlete_id','athlete_display_name','team_abbreviation','minutes','points','field_goals_made',
       'field_goals_attempted','free_throws_made','free_throws_attempted','offensive_rebounds','defensive_rebounds','assists','steals','blocks','turnovers','fouls','did_not_play','athlete_position_abbreviation','rebounds'])
    p=p[p.game_id.isin(home.game)]
    p['min']=pd.to_numeric(p.minutes,errors='coerce').fillna(0)
    p=p[(p['min']>0)].drop_duplicates(['game_id','athlete_id'])
    p['gmsc']=(p.points+0.4*p.field_goals_made-0.7*p.field_goals_attempted-0.4*(p.free_throws_attempted-p.free_throws_made)
               +0.7*p.offensive_rebounds+0.3*p.defensive_rebounds+p.steals+0.7*p.assists+0.7*p.blocks-0.4*p.fouls-p.turnovers)
    p['athlete_id']=p.athlete_id.astype('int64').astype(str)
    lines={}
    for r in p.itertuples():
        lines.setdefault((r.game_id,r.team_abbreviation),[]).append((r.athlete_id,r.min,r.gmsc,r.points,r.rebounds,r.assists,r.athlete_position_abbreviation,r.athlete_display_name))
    return {'games':home,'lines':lines,'year':year}
if __name__=='__main__':
    out={y:season(y) for y in (2023,2024,2025,2026,2027)}
    for y,s in out.items(): print(y,len(s['games']),s['games'].date.min(),s['games'].date.max(),round(s['games'].poss.mean(),1))
    pickle.dump(out,open('nba_seasons.pkl','wb'))
