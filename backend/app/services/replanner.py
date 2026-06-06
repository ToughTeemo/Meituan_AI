from __future__ import annotations

from typing import Any, Protocol

Proposal = dict[str, Any]
ReplanContext = dict[str, Any]


class Replanner(Protocol):
    def propose(self, context: ReplanContext) -> Proposal:
        ...
