"""Authenticated Vercel endpoint for grading a 2-6 leg MLB slip image."""

import asyncio
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "backend"))

import analyze  # noqa: E402
from auth_core import session_with_live_access  # noqa: E402
from prediction_core import compute_prediction  # noqa: E402


PROP_LABELS = {
    "hits": "Hits", "total_bases": "Total Bases", "home_runs": "Home Runs",
    "rbis": "RBIs", "runs_scored": "Runs Scored", "walks": "Walks",
    "hits_runs_rbis": "Hits+Runs+RBIs", "fantasy_score": "Fantasy Score",
    # The slip OCR's generic strikeout market is the pitcher prop used by VORTEX.
    "strikeouts": "Strikeouts (Pitcher)", "pitcher_strikeouts": "Strikeouts (Pitcher)",
    "pitcher_outs": "Pitching Outs", "pitcher_earned_runs": "Earned Runs Allowed",
    "pitcher_hits_allowed": "Hits Allowed", "pitcher_walks": "Walks Allowed",
    "pitcher_fantasy_score": "Fantasy Score (Pitcher)",
}


def _grade_prop(prop):
    prop_type = prop.get("prop_type") or analyze.normalize_market(prop.get("market_raw") or "")
    stat_label = PROP_LABELS.get(prop_type)
    if not stat_label:
        return {"error": f"{prop.get('player_name', 'This leg')}: unsupported market {prop.get('market_raw') or prop_type}."}
    try:
        result = compute_prediction(
            prop["player_name"], prop_type if prop_type != "strikeouts" else "pitcher_strikeouts",
            stat_label, float(prop["line"]), prop["side"],
        )
        result["detectedMarket"] = prop.get("market_raw") or stat_label
        return result
    except Exception as exc:  # Return per-leg errors without losing the other legs.
        return {"error": f"{prop.get('player_name', 'This leg')}: {exc}"}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {})

    def do_POST(self):
        if not session_with_live_access(self.headers):
            return self._send(401, {"error": "Sign in with Discord to grade a slip.", "authRequired": True})
        content_type = (self.headers.get("Content-Type") or "").split(";", 1)[0].lower()
        if content_type not in {"image/png", "image/jpeg", "image/webp"}:
            return self._send(415, {"error": "Paste or upload a PNG, JPG, or WEBP screenshot."})
        try:
            size = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            size = 0
        if size < 1 or size > 4 * 1024 * 1024:
            return self._send(413, {"error": "The screenshot must be smaller than 4 MB."})

        try:
            slip = asyncio.run(analyze.extract_slip_data(self.rfile.read(size)))
        except Exception as exc:
            return self._send(422, {"error": f"Could not read that screenshot: {exc}"})
        if slip.get("error"):
            return self._send(422, {"error": slip["error"]})
        props = slip.get("all_props") or [slip]
        if not 2 <= len(props) <= 6:
            return self._send(422, {"error": f"Detected {len(props)} complete leg{'s' if len(props) != 1 else ''}. Show 2 to 6 selected props in one screenshot."})
        incomplete = [p for p in props if not p.get("player_name") or not p.get("line") or p.get("side") not in {"over", "under"}]
        if incomplete:
            names = ", ".join(p.get("player_name") or "unknown player" for p in incomplete)
            return self._send(422, {"error": f"Could not confirm the line or selected side for {names}. Make every More/Less or Over/Under selection visible."})

        with ThreadPoolExecutor(max_workers=2) as pool:
            legs = list(pool.map(_grade_prop, props))
        graded = [leg for leg in legs if not leg.get("error")]
        if not graded:
            return self._send(422, {"error": "The legs were detected, but none could be graded against the current MLB slate.", "legs": legs})

        probabilities = []
        for leg in graded:
            probability = max(.05, min(.95, float(leg.get("estHitRate") or 0) / 100))
            leg["legProbability"] = round(probability * 100, 1)
            probabilities.append(probability)
        combined = 1.0
        for probability in probabilities:
            combined *= probability
        if len(graded) > 2:
            combined *= .95 ** (len(graded) - 2)
        combined_pct = combined * 100
        tier = "ELITE" if combined >= .35 else "STRONG" if combined >= .22 else "GOOD" if combined >= .12 else "LEAN" if combined >= .06 else "RISKY"
        weakest = min(graded, key=lambda leg: leg.get("legProbability", 0))
        self._send(200, {
            "detectedCount": len(props), "gradedCount": len(graded), "legs": legs,
            "parlayScore": round(combined_pct), "combinedProbability": round(combined_pct, 1),
            "averageLegScore": round(sum(float(leg.get("score") or 0) for leg in graded) / len(graded), 1),
            "averageL10": round(sum(probabilities) / len(probabilities) * 100, 1),
            "tier": tier, "weakestLeg": weakest.get("player"),
        })

    def _send(self, status, body):
        try:
            payload = json.dumps(body).encode("utf-8")
        except (TypeError, ValueError):
            status, payload = 500, b'{"error":"Slip analysis returned an invalid response."}'
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(payload)
