"""Read-only access check; never print credentials or response headers."""
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

def main():
    entries = dict(line.split('=', 1) for line in (Path(__file__).resolve().parents[1]/'.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
    host = 'tennis-api-atp-wta-itf.p.rapidapi.com'
    url = 'https://'+host+(sys.argv[1] if len(sys.argv)>1 else '/tennis/v2/atp/results/2026-09-29?pageSize=2&filter=PlayerGroup:singles')
    request = Request(url, headers={'X-RapidAPI-Key': entries['TENNIS_RAPIDAPI_KEY'], 'X-RapidAPI-Host': host})
    try:
        with urlopen(request, timeout=25) as response:
            data = json.load(response)
            print(json.dumps(data)[:12000])
    except HTTPError as error:
        print('HTTP', error.code, error.read().decode()[:1000])

if __name__ == '__main__':
    main()
