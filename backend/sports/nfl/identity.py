from __future__ import annotations

import re
import unicodedata

from .domain import NFLPlayer
from .services.nflverse import canonical_team

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def normalized_name(value: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    parts = re.findall(r"[a-z0-9]+", ascii_name.lower())
    if parts and parts[-1] in SUFFIXES:
        parts = parts[:-1]
    return " ".join(parts)


def player_index(players: list[NFLPlayer]) -> dict[str, NFLPlayer]:
    """Index every verified provider ID; ambiguous names are deliberately omitted."""
    index: dict[str, NFLPlayer] = {}
    names: dict[str, list[NFLPlayer]] = {}
    for player in players:
        index[f"gsis:{player.id}"] = player
        for provider, provider_id in player.source_ids.items():
            index[f"{provider}:{provider_id}"] = player
        names.setdefault(normalized_name(player.name), []).append(player)
    for name, matches in names.items():
        if name and len(matches) == 1:
            index[f"name:{name}"] = matches[0]
    return index


def resolve_player(players: list[NFLPlayer], *, provider: str | None = None,
                   player_id: str | None = None, name: str | None = None,
                   team_id: str | None = None) -> NFLPlayer | None:
    index = player_index(players)
    if provider and player_id:
        return index.get(f"{provider}:{player_id}")
    if player_id:
        return index.get(f"gsis:{player_id}")
    if name:
        match = index.get(f"name:{normalized_name(name)}")
        if match and (not team_id or match.team_id == canonical_team(team_id)):
            return match
    return None
