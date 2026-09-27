import ast
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock


class PitcherArsenalDetailTests(TestCase):
    def test_arsenal_detail_does_not_load_unrelated_splits(self):
        source = Path(__file__).resolve().parents[1] / 'prediction_core.py'
        tree = ast.parse(source.read_text(encoding='utf-8'))
        build = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == '_build_team_insights')
        stats = SimpleNamespace(SEASON=2026,
            get_batter_arsenal_stats=Mock(return_value=[{'pitch_type':'FF','pa':100,'pitches':400,'avg':.250,'woba':.310,'k_pct':22}]),
            get_batter_season_line=Mock(),get_batter_hand_splits=Mock(),get_bvp_history=Mock())
        scope = {'stats_mlb':stats,'ThreadPoolExecutor':ThreadPoolExecutor,
                 'datetime':datetime,'timezone':timezone,'_safe':lambda fn,*args,default=None:fn(*args)}
        exec(compile(ast.Module(body=[build],type_ignores=[]),str(source),'exec'),scope)
        result = scope['_build_team_insights'](1,2,'Pitcher','L',
            [{'pitch_type':'FF','pitch_name':'Fastball','pct':55,'avg_speed':94}],
            lineup=[{'id':3,'name':'Hitter','position':'CF','order':1}],detail='arsenal')
        self.assertEqual(result['pitchRows'][0]['byPitch']['FF']['pa'],100)
        self.assertTrue(result['lineupConfirmed'])
        stats.get_batter_arsenal_stats.assert_called_once_with(3)
        stats.get_batter_season_line.assert_not_called()
        stats.get_batter_hand_splits.assert_not_called()
        stats.get_bvp_history.assert_not_called()
