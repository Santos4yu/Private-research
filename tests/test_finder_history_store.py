import json
import unittest
from unittest.mock import patch
import finder_history_store as cache


class FakeStore:
    """Hashes and strings in memory; records every command it is sent."""
    def __init__(self):
        self.data, self.sent = {}, []

    def run(self, *args):
        self.sent.append(args)
        op, key = args[0], args[1]
        if op == 'HGETALL':
            return [part for pair in self.data.get(key, {}).items() for part in pair]
        if op == 'HGET':
            return self.data.get(key, {}).get(args[2])
        if op == 'HSET':
            self.data.setdefault(key, {}).update(zip(args[2::2], args[3::2]))
            return 1
        if op == 'HDEL':
            for field in args[2:]:
                self.data.get(key, {}).pop(field, None)
            return 1
        if op == 'GET':
            return self.data.get(key)
        if op == 'SET':
            self.data[key] = args[2]
            return 'OK'
        raise AssertionError(op)

    def many(self, *rows):
        return [self.run(*row) for row in rows]

    def patched(self):
        return (patch.object(cache, 'command', side_effect=self.run),
                patch.object(cache, 'commands', side_effect=self.many))

    def ops(self, op, key=None):
        return [args for args in self.sent if args[0] == op and (key is None or args[1] == key)]


def saved(at, payload=None, args=None):
    return json.dumps({'at': at, 'payload': payload or {'rows': [1]}, 'args': args or {'playerId': '1'}})


class SharedHistoryTests(unittest.TestCase):
    def setUp(self):
        for memory in (cache._index, cache._full, cache._tidied, cache._enrolled):
            memory.clear()
        cache._jobs.update(at=0.0, items=[])

    def test_success_is_atomic_and_outage_cannot_erase_sample(self):
        payload={'rows':[{'gameId':'1'}]}
        with patch.object(cache,'commands') as commands:
            self.assertIs(cache.remember('wnba','wnba:1:2026',payload,{'playerId':'1'}),payload)
            history, index = commands.call_args.args
            self.assertEqual(history[:3],['HSET','finder:history:v1:wnba','wnba:1:2026'])
            self.assertEqual(index[:3],['HSET','finder:history:at:v1:wnba','wnba:1:2026'])
            stamp=json.loads(index[3])
            self.assertEqual(stamp['args'],{'playerId':'1'})
            self.assertNotIn('payload',stamp)
            commands.reset_mock()
            for invalid in ({'rows':[]},{'error':'outage'},{'games':[1],'complete':False}):
                cache.remember('wnba','key',invalid,{})
            commands.assert_not_called()

    def test_snapshot_excludes_expired_and_private_loader_arguments(self):
        with patch.object(cache.time,'time',return_value=100000),patch.object(cache,'command',return_value=['fresh',json.dumps({'at':99999000,'payload':{'rows':[1]},'args':{'playerId':'1'}}),'old',json.dumps({'at':1,'payload':{'rows':[2]}})]):
            result=cache.snapshot('wnba')
            self.assertEqual(list(result['histories']),['fresh'])
            self.assertNotIn('args',result['histories']['fresh'])

    def test_invalid_sport_rejected(self):
        with self.assertRaises(ValueError):cache.snapshot('unknown')

    def test_board_enrollment_deduplicates_player_markets(self):
        with patch.object(cache,'command') as command:
            board={'rows':[{'playerId':'1'},{'playerId':'1'}]}
            cache.enroll_basketball('nba',board)
            self.assertEqual(len(command.call_args.args),4)

    def test_same_board_is_enrolled_once_an_hour(self):
        board={'rows':[{'playerId':'1'},{'playerId':'2'}]}
        with patch.object(cache,'command') as command:
            cache.enroll_basketball('nba',board)
            cache.enroll_basketball('nba',board)
            self.assertEqual(command.call_count,1)
            cache.enroll_basketball('nba',{'rows':board['rows']+[{'playerId':'3'}]})
            self.assertEqual(command.call_count,2)

    def test_snapshot_rereads_only_changed_histories(self):
        store=FakeStore(); now=1_000_000.0
        store.data['finder:history:v1:mlb']={'a':saved(now*1000-60_000),'b':saved(now*1000-60_000)}
        first,second=store.patched()
        with first,second,patch.object(cache.time,'time',return_value=now):
            self.assertEqual(set(cache.snapshot('mlb')['histories']),{'a','b'})
            cache.snapshot('mlb')
        self.assertEqual(len(store.ops('HGETALL')),1)  # the second page view came from memory
        # Another server refreshes 'b'; later views fetch only that history.
        later=now+cache.SNAPSHOT_MEMORY_SECONDS+1
        store.data['finder:history:v1:mlb']['b']=saved(later*1000,{'rows':[2]})
        store.data['finder:history:at:v1:mlb']={'a':json.dumps({'at':now*1000-60_000,'seen':0,'args':{}}),
                                                'b':json.dumps({'at':later*1000,'seen':0,'args':{}})}
        store.sent.clear()
        first,second=store.patched()
        with first,second,patch.object(cache.time,'time',return_value=later):
            result=cache.snapshot('mlb')['histories']
        self.assertEqual(result['b']['payload'],{'rows':[2]})
        self.assertEqual(store.ops('HGETALL','finder:history:v1:mlb'),[])
        self.assertEqual(store.ops('HGET'),[('HGET','finder:history:v1:mlb','b')])

    def test_daily_tidy_builds_index_and_drops_players_nobody_opened(self):
        store=FakeStore(); now=10*86400.0
        store.data['finder:history:v1:nhl']={'live':saved(now*1000-3600_000,args={'team':'BOS'}),
                                             'dead':saved(now*1000-8*86400_000,args={'team':'ARI'})}
        first,second=store.patched()
        with first,second,patch.object(cache.time,'time',return_value=now):
            index=cache.stamps('nhl')
        self.assertEqual(set(index),{'live'})
        self.assertEqual(index['live']['args'],{'team':'BOS'})
        self.assertNotIn('dead',store.data['finder:history:v1:nhl'])
        self.assertEqual(set(store.data['finder:history:at:v1:nhl']),{'live'})
        # The next server sees today's tidy is done and reads only the index.
        cache._index.clear(); cache._tidied.clear(); store.sent.clear()
        first,second=store.patched()
        with first,second,patch.object(cache.time,'time',return_value=now+60):
            self.assertEqual(set(cache.stamps('nhl')),{'live'})
        self.assertEqual(store.ops('HGETALL','finder:history:v1:nhl'),[])

    def test_timer_reads_small_index_and_skips_histories_refreshed_elsewhere(self):
        store=FakeStore(); now=10*86400.0
        for sport in cache.SPORTS:
            store.data['finder:history:tidy:v1:'+sport]='1'
        old=now*1000-2*cache.FRESH*1000
        store.data['finder:history:v1:tennis']={'tennis:a':saved(old,args={'player':'a'}),'tennis:b':saved(old,args={'player':'b'})}
        store.data['finder:history:at:v1:tennis']={key:json.dumps({'at':old,'seen':old,'args':{'player':key[-1]}}) for key in ('tennis:a','tennis:b')}
        first,second=store.patched()
        with first,second,patch.object(cache.time,'time',return_value=now):
            cache.stamps('tennis')
        # Another server refreshed 'a' since this server last read the index.
        store.data['finder:history:at:v1:tennis']['tennis:a']=json.dumps({'at':now*1000,'seen':now*1000,'args':{'player':'a'}})
        store.sent.clear()
        first,second=store.patched()
        with first,second,patch.object(cache.time,'time',return_value=now+60),patch.object(cache,'refresh') as refresh:
            cache.warm(budget=1,limit=1)
        self.assertEqual([call.args[:2] for call in refresh.call_args_list],[('tennis','tennis:b')])
        self.assertEqual(store.ops('HGETALL','finder:history:v1:tennis'),[])

if __name__=='__main__':unittest.main()
