import io
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

from tools import collect_cs2_history as collector


class CollectorTests(unittest.TestCase):
    def test_quote_outage_does_not_stop_result_backfill(self):
        replies=[{'readyMaps':1}, {'readyMaps':0}]
        with patch('sys.argv',['collector','--headshots','--backfill','--batches','5']), \
             patch.object(collector,'board',side_effect=RuntimeError('unavailable')) as board, \
             patch.object(collector,'warm_headshots',side_effect=replies) as warm, \
             patch.object(collector.time,'sleep'), redirect_stdout(io.StringIO()):
            collector.main()
        self.assertEqual(warm.call_count,2)
        board.assert_called_once()

    def test_watch_switches_to_normal_interval_after_initial_backfill(self):
        with patch('sys.argv',['collector','--headshots','--backfill','--watch']), \
             patch.object(collector,'board',return_value={'rows':[]}), \
             patch.object(collector,'warm_headshots',return_value={'readyMaps':0}), \
             patch.object(collector.time,'sleep',side_effect=KeyboardInterrupt) as sleep, \
             redirect_stdout(io.StringIO()):
            with self.assertRaises(KeyboardInterrupt): collector.main()
        sleep.assert_called_once_with(120)

    def test_audit_does_not_poll_quotes_or_collect_results(self):
        with patch('sys.argv',['collector','--audit']), \
             patch.object(collector,'audit',return_value={'players':0,'details':[]}), \
             patch.object(collector,'board') as board, \
             patch.object(collector,'warm_headshots') as warm, redirect_stdout(io.StringIO()):
            collector.main()
        board.assert_not_called()
        warm.assert_not_called()


if __name__=='__main__': unittest.main()
