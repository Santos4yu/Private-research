"""Compact injury report, independent of the expensive lineup pipeline."""
from datetime import datetime, timezone
from functools import lru_cache
import time
import requests


def normalize_report(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get('injuries'), list):
        raise ValueError('Invalid injury report')
    teams = []
    for group in payload['injuries']:
        players = []
        team = {}
        for injury in group.get('injuries', []):
            athlete = injury.get('athlete') or {}
            team = athlete.get('team') or team
            if not athlete.get('displayName'):
                continue
            details = injury.get('details') or {}
            # Structured medical fields avoid copying publisher names from news prose.
            reason = ' '.join(str(details[k]) for k in ('side', 'type', 'detail') if details.get(k))
            players.append({
                'id': str(injury.get('id') or athlete['displayName']),
                'name': athlete['displayName'],
                'position': (athlete.get('position') or {}).get('abbreviation', ''),
                'photo': (athlete.get('headshot') or {}).get('href', ''),
                'status': injury.get('status') or 'Status unavailable',
                'reason': reason or 'Injury details not reported',
                'reportedAt': injury.get('date'),
                'expectedReturn': details.get('returnDate'),
            })
        teams.append({'id': str(group.get('id', '')), 'name': group.get('displayName', ''),
                      'abbr': team.get('abbreviation', ''),
                      'logo': next((x.get('href') for x in team.get('logos', []) if x.get('href')), ''),
                      'players': sorted(players, key=lambda p: p['reportedAt'] or '', reverse=True)})
    return {'teams': teams, 'updatedAt': datetime.now(timezone.utc).isoformat()}


@lru_cache(maxsize=2)
def _report(bucket):
    response = requests.get('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/injuries', timeout=12)
    response.raise_for_status()
    return normalize_report(response.json())


def get_injury_report():
    return _report(int(time.time() // 300))
