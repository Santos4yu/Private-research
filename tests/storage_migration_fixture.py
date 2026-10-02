"""Synthetic SQL fixture for the local PostgreSQL migration test; no network."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_supabase_storage import backup
from tools.storage_migration import import_sql
print(import_sql(backup(), policy_confirmed=True))
