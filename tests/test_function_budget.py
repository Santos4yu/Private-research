"""Prevent adding more standalone handlers than this deployment allows."""
import ast
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class FunctionBudgetTests(unittest.TestCase):
    def test_hobby_function_budget(self):
        handlers = list((ROOT / "api").glob("*.py"))
        self.assertLessEqual(len(handlers), 12, [path.name for path in handlers])

    def test_matchup_dispatch_uses_existing_function(self):
        # Exercise the actual method without importing unrelated backend services.
        module = ast.parse((ROOT / "api/slate.py").read_text())
        handler = next(node for node in module.body if isinstance(node, ast.ClassDef))
        method = next(node for node in handler.body if isinstance(node, ast.FunctionDef) and node.name == "_matchup")
        scope = {}
        exec(compile(ast.Module(body=[method], type_ignores=[]), "slate.py", "exec"), scope)
        from unittest.mock import Mock, patch
        response = Mock()
        query = {"team": ["CIN"], "opponent": ["TOR"], "startsAt": ["2026-09-26T18:00:00Z"]}
        with patch("mlb_matchup.get_matchup", return_value={"available": True}) as lookup:
            scope["_matchup"](response, query)
            lookup.assert_called_once_with("CIN", "TOR", "2026-09-26T18:00:00Z")
            response._send.assert_called_once_with(200, {"available": True})
        response.reset_mock()
        scope["_matchup"](response, {})
        self.assertEqual(response._send.call_args.args[0], 400)
