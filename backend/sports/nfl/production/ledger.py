"""Explicit local durable shadow ledger, immutable snapshots and linked results.

No implicit /tmp/memory fallback. Serverless persistent storage is not configured.
"""
import sqlite3
import json
import hashlib
from datetime import datetime,timezone
from .decisions import timestamp
from ..distributions import finite

class ShadowLedger:
    def __init__(self,path):
        if not path or str(path)==':memory:':raise ValueError('Explicit durable NFL ledger path required')
        self.db=sqlite3.connect(path)
        tables=[row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        if any(not table.startswith('nfl_') for table in tables):
            self.db.close();raise ValueError('NFL ledger must not share an existing other-sport database')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS nfl_snapshots(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, kickoff TEXT NOT NULL, body TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS nfl_results(snapshot_id TEXT PRIMARY KEY REFERENCES nfl_snapshots(id), recorded_at TEXT NOT NULL, body TEXT NOT NULL);
          CREATE TRIGGER IF NOT EXISTS nfl_no_snapshot_update BEFORE UPDATE ON nfl_snapshots BEGIN SELECT RAISE(ABORT,'immutable snapshot'); END;
          CREATE TRIGGER IF NOT EXISTS nfl_no_snapshot_delete BEFORE DELETE ON nfl_snapshots BEGIN SELECT RAISE(ABORT,'immutable snapshot'); END;
          CREATE TRIGGER IF NOT EXISTS nfl_no_result_update BEFORE UPDATE ON nfl_results BEGIN SELECT RAISE(ABORT,'immutable result'); END;
          CREATE TRIGGER IF NOT EXISTS nfl_no_result_delete BEFORE DELETE ON nfl_results BEGIN SELECT RAISE(ABORT,'immutable result'); END;
        ''')

    def close(self):self.db.close()

    def snapshot(self,body,kickoff,now=None):
        now=now or datetime.now(timezone.utc)
        if now.tzinfo is None or now>=timestamp(kickoff):raise ValueError('Snapshot must be stored before verified kickoff')
        for key in ('playerId','gameId','propType','modelVersion','distributionVersion','decisionRuleVersion','featureVersion'):
            if not body.get(key):raise ValueError('Missing snapshot '+key)
        if body.get('mode')!='SHADOW':raise ValueError('Only shadow snapshots supported')
        if body.get('publicVerdict') not in (None,'PASS'):raise ValueError('Shadow mode cannot expose TAKE/LEAN')
        line=body.get('line')
        if line is not None:
            if not isinstance(line,dict) or line.get('provenance')!='VERIFIED_CURRENT_PROVIDER' or not line.get('source') or not finite(line.get('value')):
                raise ValueError('Unverified snapshot line')
            if any(line.get(k)!=body.get(k) for k in ('playerId','gameId','propType')):raise ValueError('Snapshot line mismatch')
            age=(now-timestamp(line.get('timestamp'))).total_seconds()
            if not 0<=age<=120:raise ValueError('Snapshot line is stale or future-dated')
        payload={**body,'createdAt':now.isoformat(),'kickoff':kickoff}
        encoded=json.dumps(payload,sort_keys=True,allow_nan=False)
        sid=hashlib.sha256(encoded.encode()).hexdigest()
        with self.db:self.db.execute('INSERT OR IGNORE INTO nfl_snapshots VALUES(?,?,?,?)',(sid,now.isoformat(),kickoff,encoded))
        return sid

    def get(self,sid):
        row=self.db.execute('SELECT body FROM nfl_snapshots WHERE id=?',(sid,)).fetchone()
        if not row:raise ValueError('Snapshot not found')
        return json.loads(row[0])

    def settle(self,sid,actual,game_status,final_line=None,now=None,result_source=None):
        now=now or datetime.now(timezone.utc);snapshot=self.get(sid)
        if game_status!='FINAL' or now<timestamp(snapshot['kickoff']) or not finite(actual) or not result_source:raise ValueError('Verified final result/source required')
        if final_line is not None and (not isinstance(final_line,dict) or final_line.get('provenance')!='VERIFIED_CURRENT_PROVIDER' or not final_line.get('source')):raise ValueError('Final line source unverified')
        line=snapshot.get('line');direction=snapshot.get('direction');grade=None
        if isinstance(line,dict) and finite(line.get('value')) and direction in ('OVER','UNDER'):
            grade='PUSH' if actual==line['value'] else 'HIT' if (actual>line['value'])==(direction=='OVER') else 'MISS'
        projection=snapshot.get('projection')
        result={'snapshotId':sid,'actual':actual,'grade':grade,'resultSource':result_source,'projectionError':projection-actual if finite(projection) else None,
                'finalLine':final_line,'recordedAt':now.isoformat()}
        encoded=json.dumps(result,sort_keys=True,allow_nan=False)
        with self.db:self.db.execute('INSERT INTO nfl_results VALUES(?,?,?)',(sid,now.isoformat(),encoded))
        return result

    def observations(self):
        output=[]
        for body,result in self.db.execute('SELECT s.body,r.body FROM nfl_snapshots s LEFT JOIN nfl_results r ON s.id=r.snapshot_id ORDER BY s.created_at'):
            s=json.loads(body);r=json.loads(result) if result else {}
            output.append({**s,**r})
        return output
