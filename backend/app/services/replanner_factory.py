from __future__ import annotations

from app.core.config import settings
from app.services.llm_replanner import LlmReplanner
from app.services.replanner import Replanner
from app.services.rule_based_replanner import RuleBasedReplanner


def get_replanner() -> Replanner:
    provider = settings.replanner_provider.strip().lower()
    if provider in {"rule", "rule_based", "rulebased"}:
        return RuleBasedReplanner()
    if provider == "llm":
        return LlmReplanner()
    raise ValueError(f"Unsupported REPLANNER_PROVIDER: {settings.replanner_provider}")
