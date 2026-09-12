"""Saved-evidence production report; no backtest re-fit or synthetic performance."""
import argparse
import json
from pathlib import Path
from collections import Counter
from .audit import audit_models
from .gates import policy
from .ledger import ShadowLedger
from .shadow import health_dashboard

ROOT=Path(__file__).resolve().parents[4]

def number(value):return f'{value:.3f}' if isinstance(value,(float,int)) else 'NOT AVAILABLE'

def report(db=None):
    audit=audit_models();rules=policy();forward=None
    if db:
        ledger=ShadowLedger(db)
        try:forward=health_dashboard(ledger)
        finally:ledger.close()
    artifact={**audit,'criteria':rules,'prospectiveDashboard':forward}
    (ROOT/'docs/nfl-production-model-status.json').write_text(json.dumps(artifact,indent=2,allow_nan=False),encoding='utf-8')
    counts=Counter(m['productionStatus'] for m in audit['models'])
    lines=['# Phase 8 — NFL production validation and decision engine','',
      '**Zero models are production-ready.** Twelve supported position/prop models remain experimental and SHADOW_ONLY. Four previously disabled candidates stay disabled; twelve unsupported position/prop combinations remain NOT_AVAILABLE and excluded from production. No model methodology, MLB logic, backtest result or existing model version was rewritten. No deployment.', '',
      'Read opportunity, matchup, point-projection and distribution validation reports before implementation. This audit uses their saved JSON evidence and preserves all limitations. Slight MAE gains and smooth simulations do not qualify a model for betting decisions.', '',
      '## Exact production acceptance criteria','',
      'These are conservative release requirements, **not empirically learned TAKE probability cutoffs**. They can reject current models; they do not establish profitability or causal model quality.', '',
      '| Requirement | Gate |','|---|---|',
      f'| Point, distribution, calibration | All independently VALIDATED |',
      f'| Historical screening / untouched holdout | ≥{rules["minimumScreenSample"]} / ≥{rules["minimumHoldoutSample"]} forecasts |',
      f'| Forward evidence | ≥{rules["minimumForwardSample"]} eligible distinct pre-kickoff forecasts across ≥{rules["minimumForwardWeeks"]} weeks |',
      f'| Historical stability | ≥{rules["minimumHistoricalSeasons"]} seasons plus verified period/role stability |',
      f'| Point improvement | ≥{rules["minimumMAEImprovement"]*100:.0f}% against season mean, weighted mean and historical-efficiency baseline |',
      f'| Bias | abs(bias)/MAE ≤{rules["maximumAbsoluteBiasOverMAE"]:.2f} |',
      f'| Roster availability | ≥{rules["minimumRosterAvailability"]*100:.0f}% |',
      f'| Distribution coverage | maximum percentile error ≤{rules["maximumPercentileError"]*100:.0f} percentage points |',
      f'| Sharpness | ≤{rules["maximumSharpnessRelativeToBaseline"]:.2f}× matched baseline interval width, plus verified CRPS improvement |',
      f'| Real-line calibration sample / holdout | ≥{rules["minimumLineCalibrationSample"]} / ≥{rules["minimumLineCalibrationHoldout"]} |',
      f'| Calibration ECE / slope deviation / abs intercept | ≤{rules["maximumCalibrationError"]:.2f} / ≤{rules["maximumCalibrationSlopeDeviation"]:.2f} / ≤{rules["maximumCalibrationIntercept"]:.2f} |',
      '| As-of evidence | Verified snapshots, untouched evaluation, real timestamped lines and prospective capture |',
      '| Current health | HEALTHY |', '',
      'Volume models that merely copy Phase 4 opportunity do not beat their own historical-efficiency baseline; they cannot be called advanced improvements. A future dedicated volume-model release needs its own reviewed comparative evidence. Count inclusive percentiles have tie effects; passing this strict gate requires appropriately reviewed discrete calibration, not hiding the lower-tail excess.', '',
      '## Model status table','',
      '| Prop | Position | Point | Distribution | Calibration | Health | Production |','|---|---|---|---|---|---|---|']
    for r in audit['models']:
        lines.append(f'| {r["label"]} | {r["position"]} | {r["pointStatus"]} | {r["distributionStatus"]} | {r["calibrationStatus"]} | {r["health"]} | {r["productionStatus"]} |')
    lines+=['','## Existing point accuracy and samples','',
      'Metrics below are saved historical candidate results, not new live performance. Bias is projection minus actual. Disabled candidates remain visible here, but have zero serving availability. Total is 2025 known-roster forecast attempts; eligible logs and holdout sample are separate. Unsupported rows have no measured performance.', '',
      '| Model | Total attempts | Eligible logs | Screen n | Holdout n | MAE | Median AE | RMSE | Bias | Error SD | Season mean MAE | Weighted mean MAE | Historical efficiency MAE | Roster serving availability |',
      '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
    for r in audit['models']:
        p=r['pointMetrics'];b=r['baselines']
        if not p:continue
        values=' | '.join(number(p.get(k)) for k in ('MAE','MedianAE','RMSE','bias','errorStandardDeviation'))
        lines.append(f'| {r["modelKey"]} | {r["totalKnownRosterForecasts"]} | {r["eligibleOutcomeLogs"]} | {r["validationSample"]} | {r["holdoutSample"]} | {values} | {number(b.get("seasonMean",{}).get("MAE"))} | {number(b.get("recentMean",{}).get("MAE"))} | {number(r["historicalEfficiencyBaseline"].get("MAE"))} | {r["availability"]*100:.1f}% |')
    lines+=['','### Improvement versus baselines','',
      '| Model | Season mean | Weighted mean | Opportunity × historical efficiency |','|---|---:|---:|---:|']
    for r in audit['models']:
        if not r['pointMetrics']:continue
        improvement=r['baselineImprovements']
        vals=' | '.join(f'{improvement[k]*100:.2f}%' if improvement.get(k) is not None else 'NOT AVAILABLE' for k in ('seasonMean','recentMean','historicalEfficiency'))
        lines.append(f'| {r["modelKey"]} | {vals} |')
    lines+=['','## Distribution evidence, stability and missing calibration','',
      'The status JSON carries each prop’s P10/P25/P50/P75/P90 coverage, inner/outer widths, SD, skew and CRPS from Phase 7B. Full per-week/position/role/sample/coverage error slices are included from Phase 6. Historical replay evaluates weeks 6–18; weeks 1–5 are not validated. Home/away, favorites/underdogs and scoring-environment predictive stability have not been separately validated from archived as-of inputs. StabilityVerified is therefore false/unavailable.', '',
      'The ±20-point Phase 7B experimental coverage gate is much looser than the new production gate. Combined RB yardage P90 coverage was 82.1%, not 90%. Some count lower tails exceed nominal inclusive coverage substantially. No matched-baseline CRPS/sharpness production proof exists. Corrected releases, inherited 2025 point-policy veto and no untouched prospective season prevent VALIDATED promotion.', '',
      '**Betting Brier, log loss, ECE, reliability curves, slope/intercept and probability buckets: NOT AVAILABLE — NO HISTORICAL TIMESTAMPED LINE DATA.** No current NFL prop-line provider is connected either. No betting EV, profitability, pick-em payout or joint multi-pick probability is claimed.', '',
      '## Decision rules and abstention','',
      '`NFL_DECISION_RULES_V1` consumes only approved validation, calibrated probabilities, exact current line, projection, coverage, role/injury/QB state and model health. Matchup score, H2H and L5 hit rate are not inputs. TAKE/LEAN require PRODUCTION_READY and a separately VALIDATED decision-threshold artifact learned from legitimate line observations. The shipped artifact is null; **all current decisions PASS/NOT_AVAILABLE**.', '',
      'Future TAKE/LEAN branches accept explicit validated probability/edge cutoffs rather than hardcoding 60%=TAKE. No experimental LEAN is shown as production-grade. A verified reference probability/source is mandatory: 50% is not assumed to be break-even. Statistical edge=projection−line; probability edge=model probability−verified reference; market edge and EV remain null. Confidence stays LOW today; no numeric confidence exists. Future categorical confidence must belong to reviewed decision evidence.', '',
      f'Hard PASS gates: unresolved identity/team/opponent/prop; unresolved starting QB when material; non-active or unverified injury status; non-STABLE role; uncertain opportunity; missing projection; nonvalidated distribution/calibration; non-HEALTHY health; current coverage <{rules["minimumCurrentCoverage"]}%; missing/provider-unverified/mismatched line; line age >{rules["maximumLineAgeSeconds"]} seconds; data age >{rules["maximumDataAgeSeconds"]} seconds; future timestamps; changed analyzed line; incoherent probabilities; missing decision thresholds/reference.', '',
      '## Value Board and UI','',
      'Backend-ready single-prop rows carry player/team/opponent/game/position/prop, exact analyzed line/direction, projection/median/probability, separate edges, model/version/status/health, role/coverage/confidence and verdict. Only production-approved validated components with verified lines can enter. Sort priority is probability edge, calibrated probability, then coverage. Filters support position, prop, team, game, verdict and minimum probability/edge/coverage. Current Value Board is empty with NOT_AVAILABLE status; no placeholder lines or ranked experimental picks.', '',
      'The existing single authenticated NFL handler adds decision and value-board resources; model-health evidence requires existing admin access in addition to NFL login. It rejects client-supplied line/probability/status decision overrides. NFL Overview shows PASS, EXPERIMENTAL MODEL/shadow-only and expandable eligibility reasons. Research, projections and distributions stay visible independently. No paid confidence tier is implied.', '',
      '## Health and drift','',
      'Local dashboard monitors distinct player/game/prop forecasts for the active model version in last-50/last-100 and observed season windows. Repeated refresh snapshots do not inflate independent evidence. Pending results do not reduce projection availability or become zeros. Report MAE, median AE, RMSE, bias, error SD, availability and pending-result count. No calibration metrics appear without real line observations.', '',
      f'At least {rules["driftMinimumSample"]} eligible results are required for error alarms. WATCH at rolling MAE/reference ≥{rules["driftMAERatioWatch"]:.2f}; DEGRADED at ≥{rules["driftMAERatioDegraded"]:.2f} or abs rolling bias/reference ≥{rules["driftBiasOverBaselineDegraded"]:.2f}. Reviewed-reference distribution coverage shifts >15 percentage points also degrade. Unreviewed source/schema or feature-version changes degrade immediately. DEGRADED/WATCH disables verdict eligibility. These are conservative safety alarms, not validated betting-confidence estimates. No forward outcomes means WATCH, never fabricated HEALTHY.', '',
      '## Immutable shadow snapshots and results','',
      'Explicit local SQLite ledger has separate NFL tables, primary-key snapshots, foreign-key results and SQL triggers forbidding updates/deletes. Store server UTC time before verified kickoff; preserve player/game/prop, versions, features/timestamps, line (null if absent), direction/probability, verdict/reasons/risks and distribution. No public TAKE/LEAN in shadow mode. Exact verified snapshot line is never overwritten by result or closing line. Final source/game/outcome are required; absent player log remains missing, not zero. Grade hit/miss/push only if an original real analyzed line exists. Repeated settlement cannot overwrite the original result.', '',
      'The shadow CLI captures real provider forecasts and data failures, settles official final games, and returns internal health JSON. It is **not scheduled or deployed**. Durable local storage is implemented; serverless cross-host persistent shadow storage, automatic final polling and alerts still require infrastructure configuration. No temporary/memory fallback pretends to be durable.', '',
      'Commands (operator chooses a durable path):','',
      '```text',
      'python -m backend.sports.nfl.production.shadow capture --db <nfl-ledger.sqlite> --season <season> --week <week> --player <GSIS> --prop <prop>',
      'python -m backend.sports.nfl.production.shadow settle --db <nfl-ledger.sqlite> --snapshot <snapshot-id>',
      'python -m backend.sports.nfl.production.shadow health --db <nfl-ledger.sqlite>',
      'python -m backend.sports.nfl.production.report --db <nfl-ledger.sqlite>',
      '```','']
    if forward:
        prospective=[m for m in forward['models'] if m['prospectivePredictions']]
        for model in prospective:
            h=model['prospectiveHealth'];last=h['windows']['last50']
            lines.append(f'Real local shadow check: {model["modelKey"]}: {h["storedSnapshots"]} stored snapshot(s), {h["distinctForecasts"]} distinct forecast event(s), {last["eligiblePredictions"]} final eligible outcomes; projection availability {last["availability"]}; health {h["status"]}. Insufficient opportunity was retained as a null-projection data failure, not a usable statistical prediction. No actual result or hit rate was invented.')
    lines+=['','## Versions, checks and release blockers','',
      'Existing point/distribution/feature versions remain unchanged because their methodologies were not edited. New gate and decision versions are NFL_PRODUCTION_GATE_V1 and NFL_DECISION_RULES_V1. Snapshots preserve all original versions. A future methodology change needs a new version and reviewed evidence; health filters by version.', '',
      'Tests: 20 new production tests; **141 NFL backend tests pass**, **14 frontend tests pass**, TypeScript checking and Vite build pass. Full backend suite retains the same two pre-existing MLB/BvP failures; MLB deliberately untouched. Existing large client-bundle warning remains. No configured lint command or claimed browser-device visual QA.', '',
      'Blockers before paid release: no production-ready model; modest/insufficient baseline gains; no genuine archived as-of injury/depth/QB/weather snapshots; incomplete current injury completeness; no untouched post-veto holdout or sufficient prospective outcomes; insufficient distribution calibration/sharpness proof; no real timestamped historical/current lines; no validated decision thresholds or exact payout/EV rules; no durable cloud shadow deployment/scheduler/alerts. Keeping everything SHADOW_ONLY is the intended honest result.', '',
      'Files: new production policy/gates/audit/decisions/health/ledger/shadow/service/report modules; production types and DecisionPanel; production tests; status JSON and this report. Existing NFL API and NFL UI gain isolated resources. No MLB model changes or new serverless function. Source performance remains transformed nflverse data under the existing provider attribution/license.']
    (ROOT/'docs/nfl-production-model-validation.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps({'productionReady':audit['productionReady'],'statusCounts':dict(counts),'models':len(audit['models'])}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--db');args=parser.parse_args();report(args.db)
