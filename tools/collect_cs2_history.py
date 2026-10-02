"""Optional free always-on collector, sharing the website's saved-result store.

Run once: python tools/collect_cs2_history.py
Keep collecting: python tools/collect_cs2_history.py --watch
The website's existing moves-tick and daily cron also call this collector.
"""
import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cs2_board import board
from cs2_history import warm, warm_headshots


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true')
    parser.add_argument('--interval', type=int, default=120)
    parser.add_argument('--backfill', action='store_true', help='Fast initial backfill for up to 20 batches')
    parser.add_argument('--headshots', action='store_true', help='Shared scoreboard backfill for missing headshots')
    args = parser.parse_args()
    batches = 0
    while True:
        try:
            current = board(force=True)
            result = warm_headshots(budget=50, limit=60) if args.headshots else warm(budget=50, limit=24, max_maps=12, force=args.backfill)
            print({'lines': len(current['rows']), **result}, flush=True)
        except Exception as error:
            print({'status': 'retrying', 'error': type(error).__name__}, flush=True)
        batches += 1
        if not args.watch and (not args.backfill or batches>=20): break
        time.sleep(2 if args.backfill else max(60, args.interval))


if __name__ == '__main__': main()
