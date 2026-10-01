"""Store the private local key in existing server-side KV, without exposing it."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import tennis_live

if __name__ == '__main__':
    key=tennis_live.setting('TENNIS_RAPIDAPI_KEY')
    if not key:
        raise SystemExit('Local tennis key missing.')
    tennis_live.redis('SET',tennis_live.PREFIX+'api-key',key)
    tennis_live.track_players(['Bryce Nakashima','Jack Kennedy','Alejandro Davidovich Fokina', 'Alevtina Ibragimova','Adolfo Daniel Vallejo'])
    print('Private key saved to the existing server-side store.')
    print(tennis_live.tick(budget=40))
