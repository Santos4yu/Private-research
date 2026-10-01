"""Normalize the provider's free season downloads into a deployable snapshot.

Usage: python tools/import_tennis_history.py downloaded-season.csv ...
Source: https://tennisdata.app/downloads/ (free ATP/WTA main-tour + Challenger).
This command mechanically imports source data; it never fills missing stats.
"""
import csv
import gzip
import json
from pathlib import Path
import sys
import time

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tennis_history import parse_csv_match


def main(paths):
    rows={}
    for source in paths:
        with open(source,encoding='utf-8-sig',newline='') as stream:
            for record in csv.DictReader(stream):
                for row in parse_csv_match(record):
                    rows[(row['gameId'],row['playerId'])]=row
    payload={'importedAt':int(time.time()*1000),'source':'https://tennisdata.app/downloads/',
             'files':[Path(path).name for path in paths],'games':list(rows.values())}
    target=Path(__file__).resolve().parents[1]/'data'/'tennis'/'history.json.gz'
    target.parent.mkdir(parents=True,exist_ok=True)
    with gzip.open(target,'wt',encoding='utf-8') as stream:
        json.dump(payload,stream,separators=(',',':'))
    print(f"Imported {len(rows)} player-match records; {target.stat().st_size} bytes")


if __name__=='__main__':
    main(sys.argv[1:])
