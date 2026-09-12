from __future__ import annotations

from dataclasses import dataclass

from .domain import NFLPosition, NFLPropKey


@dataclass(frozen=True)
class NFLPropDefinition:
    key: NFLPropKey
    label: str
    positions: frozenset[NFLPosition]
    model_id: str


def _definition(key: NFLPropKey, label: str, positions: str, model_id: str) -> NFLPropDefinition:
    return NFLPropDefinition(key, label, frozenset(NFLPosition(position) for position in positions.split()), model_id)


NFL_PROP_DEFINITIONS = (
    _definition(NFLPropKey.PASSING_YARDS, "Passing Yards", "QB", "nfl.qb.passing_yards"),
    _definition(NFLPropKey.PASSING_ATTEMPTS, "Passing Attempts", "QB", "nfl.qb.passing_attempts"),
    _definition(NFLPropKey.PASS_COMPLETIONS, "Pass Completions", "QB", "nfl.qb.pass_completions"),
    _definition(NFLPropKey.PASSING_TOUCHDOWNS, "Passing TDs", "QB", "nfl.qb.passing_touchdowns"),
    _definition(NFLPropKey.INTERCEPTIONS, "Interceptions", "QB", "nfl.qb.interceptions"),
    _definition(NFLPropKey.RUSHING_YARDS, "Rushing Yards", "QB RB", "nfl.position.rushing_yards"),
    _definition(NFLPropKey.RUSH_ATTEMPTS, "Rush Attempts", "QB RB", "nfl.position.rush_attempts"),
    _definition(NFLPropKey.PASSING_RUSHING_YARDS, "Passing + Rushing Yards", "QB", "nfl.qb.passing_rushing_yards"),
    _definition(NFLPropKey.RECEIVING_YARDS, "Receiving Yards", "RB WR TE", "nfl.receiver.receiving_yards"),
    _definition(NFLPropKey.RECEPTIONS, "Receptions", "RB WR TE", "nfl.receiver.receptions"),
    _definition(NFLPropKey.TARGETS, "Targets", "WR TE", "nfl.receiver.targets"),
    _definition(NFLPropKey.LONGEST_RECEPTION, "Longest Reception", "WR TE", "nfl.receiver.longest_reception"),
    _definition(NFLPropKey.RUSHING_RECEIVING_YARDS, "Rushing + Receiving Yards", "RB", "nfl.rb.rushing_receiving_yards"),
    _definition(NFLPropKey.TOUCHDOWNS, "Touchdowns", "RB WR TE", "nfl.position.touchdowns"),
    _definition(NFLPropKey.FANTASY_SCORE, "Fantasy Score", "QB RB WR TE", "nfl.position.fantasy_score"),
)


def props_for_position(position: NFLPosition) -> tuple[NFLPropDefinition, ...]:
    return tuple(definition for definition in NFL_PROP_DEFINITIONS if position in definition.positions)

