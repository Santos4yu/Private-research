"""Underdog CS2 lines, with explicit map scopes and original quote IDs."""
import re
import time
from datetime import datetime
import requests

URL = 'https://api.underdogfantasy.com/v1/over_under_lines'

def parse(payload, now=None):
    now = time.time() if now is None else now
    players = {p['id']:p for p in payload.get('players',[]) if p.get('sport_id')=='CS'}
    appearances = {a['id']:a for a in payload.get('appearances',[])}
    games = {g['id']:g for g in payload.get('games',[]) if g.get('sport_id')=='CS'}
    rows=[]
    for quote in payload.get('over_under_lines',[]):
        info=quote.get('over_under',{}).get('appearance_stat',{})
        appearance=appearances.get(info.get('appearance_id'),{})
        player=players.get(appearance.get('player_id'))
        game=games.get(appearance.get('match_id'))
        if not player or not game or quote.get('status')!='active' or quote.get('live_event') or game.get('status')!='scheduled':
            continue
        try:
            start=game['scheduled_at']
            if datetime.fromisoformat(start.replace('Z','+00:00')).timestamp()<=now:
                continue
            value=float(quote['stat_value'])
        except (KeyError,ValueError,TypeError):
            continue
        raw=info.get('stat') or ''
        match=re.fullmatch(r'(kills|headshots)_on_maps?_(\d(?:_\d)*)',raw)
        if not match:
            continue  # An unrecognized scope must never become a full-match prop.
        maps=match[2].split('_')
        scope='MAP '+maps[0] if len(maps)==1 else 'MAPS '+'-'.join(maps)
        stat=scope+' '+match[1].title()
        options=[o for o in quote.get('options',[]) if o.get('status')=='active' and o.get('choice') in ('higher','lower')]
        if not any(o.get('choice')=='higher' for o in options):
            continue
        prices={}
        for option in options:
            try: prices['over' if option.get('choice')=='higher' else 'under']=int(option['american_price'])
            except (KeyError,ValueError,TypeError): pass
        rows.append({'id':'ud:'+quote['id'],'player':' '.join(filter(None,[player.get('first_name'),player.get('last_name')])).strip(),
                     'playerId':player['id'],'headshot':player.get('image_url'),
                     'teamAbbr':None,'opponent':game.get('full_team_names_title') or game.get('title'),
                     'startsAt':start,'stat':stat,'marketKey':re.sub('[^a-z0-9]','',stat.lower()),
                     'line':value,'modifier':'standard','apps':[{'key':'underdog','name':'Underdog',**prices}],
                     'source':'underdog','lineType':quote.get('line_type')})
    return rows

def fetch():
    response=requests.get(URL,headers={'Accept':'application/json','User-Agent':'Mozilla/5.0'},timeout=12)
    response.raise_for_status()
    payload=response.json()
    if not isinstance(payload.get('over_under_lines'),list):
        raise ValueError('Invalid Underdog feed')
    rows=parse(payload)
    try:
        from line_moves import observe_prizepicks
        observe_prizepicks('CS2',[{'player':r['player'],'stat':r['stat'],'line':r['line'],
                                 'start_time':r['startsAt'],'odds_type':'standard','description':r['opponent']}
                                for r in rows if r.get('lineType')=='balanced'],app='underdog')
    except Exception:
        pass
    return rows
