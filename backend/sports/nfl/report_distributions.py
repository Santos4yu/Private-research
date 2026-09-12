"""Generate the Phase 7B report and compressed forecast artifact from real replay."""
import json
import gzip
import hashlib
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[3]

def report():
    result=json.loads((ROOT/'docs/nfl-distribution-results.json').read_text(encoding='utf-8'))
    raw=ROOT/'docs/nfl-distribution-forecasts.jsonl'
    counts=Counter();zeros=Counter();missing=Counter()
    with raw.open(encoding='utf-8') as f:
        for line in f:
            row=json.loads(line);key=row['position']+'.'+row['propType']
            if row['latestInputWeek']>=row['week']:raise ValueError('Future leakage in captured inputs')
            counts[(row['season'],key)]+=1
            if row['actual']==0:zeros[key]+=1
            if row['actual'] is None:missing[key]+=1
    compressed=raw.with_suffix('.jsonl.gz')
    with raw.open('rb') as source,compressed.open('wb') as target:
        with gzip.GzipFile(fileobj=target,mode='wb',mtime=0) as gz:
            while chunk:=source.read(1024*1024):gz.write(chunk)
    manifest={'forecastCount':sum(counts.values()),'capturedBySeasonProp':{f'{year}:{key}':n for (year,key),n in sorted(counts.items())},
              'legitimateZeroOutcomes':dict(zeros),'missingOutcomes':dict(missing),
              'compressedArtifact':'nfl-distribution-forecasts.jsonl.gz',
              'sha256':hashlib.sha256(compressed.read_bytes()).hexdigest(),
              'snapshotStatus':'CORRECTED_RELEASE_PRIOR_WEEK_REPLAY','informationCutoffTimestamp':None}
    (ROOT/'docs/nfl-distribution-forecast-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    lines=['# Phase 7B — NFL distribution and uncertainty validation','',
      'Implemented locally. All twelve supported distributions are **EXPERIMENTAL**, and all underlying Phase 6 point models remain **EXPERIMENTAL**. None is VALIDATED. No deployment, betting verdict, invented line or injury probability.', '',
      '## Historical forecast capture','',
      f'{sum(counts.values()):,} forecasts were captured across 2023–2025. The compressed JSONL artifact and forecast manifest retain season/week/game/player/position/team/opponent/prop, Phase 4 volume and role metrics, Phase 6 mean/efficiency/version/coverage, actual outcome and latest input week. Legitimate zeros remain zero; absent outcome logs remain null. Unsupported routes are absent, never inferred from snaps. Information-cutoff timestamp and injury/weather/depth snapshots are null.', '',
      'This is a prior-week chronological replay of corrected end-season releases, **not perfect point-in-time data**. Point-model policy inherits Phase 6 selection on 2024 and its 2025 veto. Distribution parameters fit 2023; distribution choice uses 2024; 2025 can only disable. No final-holdout tuning. Another untouched season and historical snapshots are needed for stronger validation.', '',
      '## Method and selection','',
      'Candidates: empirical forecast-error residual bootstrap for count/yardage marginals; exact Poisson counts where appropriate; shared football-process beta/binomial opportunities and gamma compound yardage. Gamma/log-normal standalone yardage were not selected because legitimate negative yardage exists; process gamma remains a limited nonnegative candidate. Negative-binomial is not yet fitted; beta-binomial behavior is provided by uncertain beta rates plus binomial draws.', '',
      'Residual pool is position/prop specific and contains 2023 actual-minus-point-forecast errors. It carries empirical forecast uncertainty and skew, without claiming separately identified parameter variance. It is not a multi-player joint yardage model. Count candidates respect shared simulated team/player capacity. Combined RB yardage is eligible only for the process candidate, never two unrelated marginal resamples.', '',
      'Selection minimizes 2024 empirical CRPS among candidates with at least 100 eligible forecasts. Final gate needs at least 100 holdout outcomes and inclusive P10/P25/P50/P75/P90 coverage within 20 percentage points of nominal. This deliberately permissive experimental gate is **not calibration validation**. Discrete ties inflate inclusive count coverage; poor count lower-tail coverage is reported, not hidden. CRPS, availability and interval width are reported together.', '',
      'Historical candidate evaluation uses 512 deterministic draws per forecast. Availability below is conditional on already supported Phase 6 forecasts, not all NFL players. See the JSON artifact for all candidate comparisons; not all candidates use identical eligible samples, a limitation of selection.', '',
      '| Prop | Point / distribution | Train forecasts | Screen usable | Holdout usable | Method | P10 | P25 | P50 | P75 | P90 | P25–P75 width | CRPS | Availability |',
      '|---|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|']
    for key,r in result['reports'].items():
        if r.get('distributionStatus')=='DISABLED':
            lines.append(f'| {key} | DISABLED / DISABLED | — | — | — | — | — | — | — | — | — | — | — | 0% |');continue
        h=r['holdout'];s=r['screeningCandidates'][r['selectedMethod']];c=h['coverage']
        fields=' | '.join(f'{c[f"p{p}"]*100:.1f}%' for p in (10,25,50,75,90))
        lines.append(f'| {key} | EXPERIMENTAL / EXPERIMENTAL | {r["trainingSample"]} | {s["n"]} | {h["n"]} | {r["selectedMethod"]} | {fields} | {h["meanInterquartileWidth"]:.2f} | {h["CRPS"]:.3f} | {h["availability"]*100:.1f}% |')
    lines+=['','### Additional holdout sharpness and skew diagnostics','',
            '| Prop | Mean P10–P90 width | Mean simulated SD | Mean minus median |',
            '|---|---:|---:|---:|']
    for key,r in result['reports'].items():
        h=r.get('holdout') or {}
        if h.get('meanP10P90Width') is not None:
            lines.append(f'| {key} | {h["meanP10P90Width"]:.2f} | {h["meanStandardDeviation"]:.2f} | {h["meanMinusMedian"]:.2f} |')
    lines+=['','## Shared state and parameter uncertainty','',
      'Simulated total plays vary with Phase 4 observed play SD. Estimated play mean also varies by SD/sqrt(sample). Dropback share and pass-attempt fraction draw beta rates using observed sample exposure. Called rushes occupy remaining non-spike plays. Scrambles use the Phase 4 official-minus-called-rush accounting and occupy non-attempt dropbacks; sacks are the remaining non-attempt dropbacks. Official rush capacity equals called rushes plus scrambles. QB player attempts are drawn separately within team attempts.', '',
      'Targets and carries use uncertain role shares with effective sample exposure. Changed roles halve effective role exposure without automatically lowering the mean; severe UNCERTAIN role blocks an unconditional distribution. This changed-role rule is an experimental heuristic, not a validated injury response. Catch/completion rates draw beta parameters from real Phase 6 exposure; yardage efficiency draws gamma parameters with exposure-informed variability. Conditional gamma totals depend on simulated opportunities. Full per-play tracking/tail distributions remain unavailable.', '',
      'RB receiving and rushing share plays/dropbacks/rush capacity in the same draw, then their yardage components sum exactly. A roster multinomial allocation port reconciles player shares to shared capacity and leaves unused capacity unassigned. Complete QB↔receiver yardage coupling is not implemented. Passing+rushing stays unavailable because QB rushing yards is unsupported.', '',
      'Unresolved injury scenarios have no invented weights and block unconditional distributions. The service returns unavailable conditional-scenario descriptors when alternative opportunity/efficiency is unsupported; it does not fabricate active/out distributions. Complete scenario-specific distributions require supported scenario inputs.', '',
      '## Convergence and serving performance','',
      f'Chosen serving count: **{result["servingCount"]:,}**. Tests used 5,000/10,000/25,000/50,000 draws and seeds 11/23/37 for one real holdout forecast per enabled prop. The smallest count passing all contexts was selected. Gate: across-seed diagnostic event probability range ≤1.5 percentage points, mean range ≤5% of statistic scale, P90 range ≤10% of scale. This is numerical convergence, not statistical model certainty.', '',
      'The threshold is the model mean and is labelled MODEL_MEAN_STATISTICAL_DIAGNOSTIC_NOT_MARKET_LINE. It is not PrizePicks history or betting calibration. Complete means/medians/percentiles/probability runs and runtime are in the results JSON. One context per prop is limited convergence coverage; representative extreme and new-role contexts should be added.', '',
      '## Service, cache and UI','',
      'The existing authenticated single NFL API function adds `/api/nfl/distribution`; it accepts regular-season player/week/prop and rejects line/side inputs. Warm-process NFL cache identity fingerprints football inputs, role/injury context, parameters, seed, point version and distribution version, excluding transient generation/fetch timestamps. Football input changes invalidate it. TTL remains the NFL projection cache policy. Cross-process persistent simulation cache is not implemented.', '',
      'Only summarized mean/median/percentiles/variance/SD/histogram are sent to the browser. Mean is simulation-derived and separately preserves pointProjectionMean: compound/process mean may differ from the Phase 6 point mean, and residual means include learned forecast bias. Median is never copied from the point mean. Floor=P25 and ceiling=P75, not guarantees. Volatility uses SD/max(1,abs(mean)): LOW <0.35, MEDIUM 0.35–0.75, HIGH ≥0.75. These descriptive labels are not model confidence.', '',
      'NFL Overview includes experimental distribution cards and a histogram with mean/median/P25/P75 markers. Missing, stale selected-prop responses and unavailable models cannot show distribution numbers. No fake line marker or numeric universal certainty. Role/sample reliability and core coverage remain separate; overall status stays experimental.', '',
      '## Unavailable props and betting calibration','',
      'TE targets, QB attempts, QB interceptions and QB rush attempts remain DISABLED with Phase 6. TDs, longest reception, QB rushing yards, pass+rush yards and fantasy remain NOT_AVAILABLE. No distribution is VALIDATED.', '',
      '**Betting Brier, calibrated Brier, betting log loss, calibration slope/intercept, probability buckets, Over/Under hit rates, EV and profitability: NOT AVAILABLE — NO HISTORICAL TIMESTAMPED LINE DATA.** No reliable current PrizePicks line feed exists either, so live comparison stays unavailable.', '',
      'Offline raw over/under/push math and diagnostics are preserved. Future logistic/beta/isotonic calibration artifact transforms require real timestamped-line provenance, a sample gate and a training cutoff preceding evaluated observations. No production curve is fitted, selected or served.', '',
      '## Verification and limitations','',
      '121 NFL backend tests pass; 14 frontend tests pass. TypeScript check and Vite build pass. Full backend baseline retains the same two existing MLB/BvP failures. Existing large client-bundle warning remains. No configured lint command. Browser/device visual QA is not claimed.', '',
      'Tests cover deterministic simulation, percentile/skew behavior, valid zero/missing distinction, future exclusion, count capacity, called-rush/scramble accounting, shared RB sums, parameter variance, uncertain roles/injury gates, roster reconciliation, CRPS, coverage diagnostics, calibration abstention/cutoffs, summarized caching and invalidation, API line rejection and model status gates.', '',
      'Weakest areas: permissive experimental percentile gate; count tie effects; inherited final-season point-policy veto; incomplete as-of snapshots; outcome-log conditional availability; pooled residuals do not adapt tails to new roles; process gamma is a simplified candidate and does not model negative per-play yardage or tracking tails; partial opponent features; no validated numeric certainty; unknown current injury completeness; no full multi-player yardage simulation. The process is not a complete drive/play-by-play simulator.', '',
      'Prioritize timestamped pregame injury/depth/QB/active snapshots, charted rush/route/coverage/pressure and reception-length distributions, and a licensed timestamped historical/current prop-line feed. These are exact blockers to stronger evidence and betting calibration, not reasons to invent values.', '',
      'New files: distribution_engine.py, distribution_service.py, validate_distributions.py, report_distributions.py, calibration.py, distribution policy/results/forecast artifacts, DistributionPanel.jsx and distribution-engine/service tests. Existing primitives and diagnostic utilities are preserved. Modified: Phase 6 replay gains optional forecast capture; existing single api/nfl.py and NFL SportResearch.jsx integrate summaries; git/deployment ignores exclude the large raw capture. MLB logic is unchanged.']
    (ROOT/'docs/nfl-distribution-calibration-validation.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps({'forecasts':sum(counts.values()),'zeroOutcomes':sum(zeros.values()),'compressedBytes':compressed.stat().st_size}))

if __name__=='__main__':report()
