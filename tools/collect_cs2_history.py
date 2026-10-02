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
from cs2_history import warm


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true')
    parser.add_argument('--interval', type=int, default=120)
    args = parser.parse_args()
    while True:
        try:
            current = board(force=True)
            result = warm(budget=45, limit=4)
            print({'lines': len(current['rows']), **result}, flush=True)
        except Exception as error:
            print({'status': 'retrying', 'error': type(error).__name__}, flush=True)
        if not args.watch: break
        time.sleep(max(60, args.interval))


if __name__ == '__main__': main()
