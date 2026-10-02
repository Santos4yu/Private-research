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
from cs2_history import warm, warm_headshots, audit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true')
    parser.add_argument('--interval', type=int, default=120)
    parser.add_argument('--backfill', action='store_true', help='Fast initial backfill for up to 20 batches')
    parser.add_argument('--headshots', action='store_true', help='Shared scoreboard backfill for missing headshots')
    parser.add_argument('--listings', action='store_true', help='Preload all public history pages before headshot backfill')
    parser.add_argument('--batches', type=int, default=20, help='Maximum accelerated backfill batches')
    parser.add_argument('--audit', action='store_true', help='Read-only all-player coverage and source-failure report')
    args = parser.parse_args()
    if args.batches < 1: parser.error('--batches must be positive')
    if args.headshots and args.listings: parser.error('Choose --headshots or --listings')
    if args.audit:
        report = audit()
        details = report.pop('details')
        print(report, flush=True)
        for player in sorted(details, key=lambda p: sum(s['missingHeadshots'] for s in p['scopes'].values()), reverse=True):
            if player['partial']: print(player, flush=True)
        return
    batches = 0
    current, quotes_at = None, 0
    while True:
        try:
            # Line polling and historical backfill have different cadences.
            # A blocked quote feed must not delay every batch of game logs.
            if current is None or time.monotonic()-quotes_at >= 120:
                try:
                    current = board()
                except Exception as error:
                    print({'quotes':'retrying', 'error':type(error).__name__}, flush=True)
                    current = current or {'rows':[]}
                finally:
                    quotes_at = time.monotonic()
            result = warm_headshots(budget=50, limit=60) if args.headshots else warm(budget=50, limit=48 if args.listings else 24,
                                                                                 max_maps=12, force=args.backfill, listing_only=args.listings)
            print({'lines': len(current['rows']), **result}, flush=True)
            if args.backfill and args.headshots and not result['readyMaps']:
                if not args.watch: break
                args.backfill = False
        except Exception as error:
            print({'status': 'retrying', 'error': type(error).__name__}, flush=True)
        batches += 1
        if args.backfill and batches>=args.batches:
            if not args.watch: break
            args.backfill = False
        if not args.watch and not args.backfill: break
        time.sleep(2 if args.backfill else max(60, args.interval))


if __name__ == '__main__': main()
