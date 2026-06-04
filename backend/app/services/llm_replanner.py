from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from app.core.config import settings
from app.services.llm_client import DeepSeekClient, DeepSeekClientConfig, DeepSeekClientError
from app.services.provider_catalog import ProviderCatalog
from app.services.replanner import Proposal, ReplanContext
from app.services.rule_based_replanner import RuleBasedReplanner


@dataclass(frozen=True)
class LlmProposalDraft:
    strategy: str
    reason: str
    proposal_summary: str
    target_poi_id: str


class LlmDraftError(RuntimeError):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class LlmReplanner:
    PROMPT_TEMPLATE = """You are a replan proposal generator.
Return JSON only and use exactly these keys:
{
  "strategy": "...",
  "reason": "...",
  "proposal_summary": "...",
  "target_poi_id": "..."
}

Input sections:
- current plan
- risk flags
- execution snapshot
- provider candidates
- budget
- user prompt

Rules:
- Choose exactly one target_poi_id from provider candidates.
- Do not output any extra keys.
- Keep strategy concise and stable.
"""

    def __init__(self, catalog: ProviderCatalog | None = None) -> None:
        self.catalog = catalog or ProviderCatalog()
        self.last_fallback_reason: str | None = None

    def propose(self, context: ReplanContext) -> Proposal:
        self.last_fallback_reason = None
        risk_type = self._text(context.get("risk_type"), "NONE")
        if not bool(context.get("need_replan")):
            return self._empty_proposal(
                context,
                risk_type,
                "当前决策不需要重规划",
            )

        if self._mock_mode():
            raw_output = self._mock_llm_output(context)
            draft = self._parse_draft(raw_output)
            if draft is None:
                self.last_fallback_reason = "mock_output_invalid"
                return self._rule_based_fallback(context, risk_type)
            proposal = self._proposal_from_draft(context, risk_type, draft)
            if proposal is None:
                self.last_fallback_reason = "mock_invalid_target_poi_id"
                return self._rule_based_fallback(context, risk_type)
            return proposal

        prompt = self._build_prompt(context)
        try:
            raw_output = self._invoke_deepseek(prompt)
            draft = self._parse_draft(raw_output)
            if draft is None:
                raise LlmDraftError("deepseek_invalid_json")
            proposal = self._proposal_from_draft(context, risk_type, draft)
            if proposal is None:
                raise LlmDraftError("deepseek_invalid_target_poi_id")
            return proposal
        except LlmDraftError as exc:
            self.last_fallback_reason = exc.reason
            return self._rule_based_fallback(context, risk_type)

    def _invoke_deepseek(self, prompt: str) -> str:
        client = DeepSeekClient(
            DeepSeekClientConfig(
                api_key=settings.deepseek_api_key,
                base_url=settings.deepseek_base_url,
                model=settings.deepseek_model,
            )
        )
        try:
            return client.complete_json(self.PROMPT_TEMPLATE, prompt)
        except DeepSeekClientError as exc:
            reason = self._fallback_reason_from_client_error(str(exc))
            raise LlmDraftError(reason) from exc

    def _fallback_reason_from_client_error(self, message: str) -> str:
        if message == "missing_api_key":
            return "deepseek_missing_api_key"
        if message.startswith("http_error:"):
            return "deepseek_http_error"
        if message.startswith("request_error:"):
            return "deepseek_request_error"
        if message.startswith("invalid_response:"):
            return "deepseek_invalid_response"
        return "deepseek_unknown_error"

    def _rule_based_fallback(self, context: ReplanContext, risk_type: str) -> Proposal:
        return RuleBasedReplanner(self.catalog).propose(context)

    def _build_prompt(self, context: ReplanContext) -> str:
        payload = {
            "current_plan": self._dict(context.get("current_plan")),
            "risk_flags": self._list(context.get("risk_flags")),
            "execution_snapshot": self._dict(context.get("execution_context")),
            "provider_candidates": self._provider_candidates(context),
            "budget": self._number(context.get("budget"), 0),
            "user_prompt": self._text(context.get("user_prompt"), ""),
        }
        return f"{self.PROMPT_TEMPLATE}\n{json.dumps(payload, ensure_ascii=False, indent=2)}"

    def _parse_draft(self, raw_output: str) -> LlmProposalDraft | None:
        try:
            payload = json.loads(raw_output)
        except json.JSONDecodeError:
            return None
        if not isinstance(payload, dict):
            return None

        expected_keys = {
            "strategy",
            "reason",
            "proposal_summary",
            "target_poi_id",
        }
        if set(payload.keys()) != expected_keys:
            return None

        strategy = self._text(payload.get("strategy"), "")
        reason = self._text(payload.get("reason"), "")
        proposal_summary = self._text(payload.get("proposal_summary"), "")
        target_poi_id = self._text(payload.get("target_poi_id"), "")
        if not all([strategy, reason, proposal_summary, target_poi_id]):
            return None
        return LlmProposalDraft(
            strategy=strategy,
            reason=reason,
            proposal_summary=proposal_summary,
            target_poi_id=target_poi_id,
        )

    def _proposal_from_draft(
        self,
        context: ReplanContext,
        risk_type: str,
        draft: LlmProposalDraft,
    ) -> Proposal | None:
        candidate_ids = {candidate.get("poi_id") for candidate in self._provider_candidates(context)}
        if draft.target_poi_id not in candidate_ids:
            return None

        current_card = self._current_card(context)
        old_card_id = self._text(
            current_card.get("card_id"),
            self._text(context.get("current_card_id"), ""),
        )
        old_poi = self._dict(current_card.get("poi"))
        old_poi_id = self._text(old_poi.get("poi_id"), "")
        new_poi = self._build_new_poi(draft.target_poi_id)
        if not new_poi:
            return None

        return {
            "replanned": True,
            "strategy": draft.strategy,
            "risk_type": risk_type,
            "reason": draft.reason,
            "proposal_summary": draft.proposal_summary,
            "old_poi": deepcopy(old_poi),
            "new_poi": new_poi,
            "requires_user_confirmation": True,
            "old_card_id": old_card_id or None,
            "old_poi_id": old_poi_id or None,
        }

    def _build_new_poi(self, target_poi_id: str) -> dict[str, Any]:
        poi = self.catalog.get_poi(target_poi_id)
        if poi is None:
            return {}
        hours = self.catalog.get_hours(target_poi_id)
        price = self.catalog.get_price(target_poi_id)
        queue = self.catalog.get_queue(target_poi_id)
        booking = self.catalog.get_booking(target_poi_id)
        new_poi = deepcopy(poi)
        new_poi["hours_label"] = self._text(hours.get("hours_label"), self._text(poi.get("hours_label"), ""))
        new_poi["is_open_at_arrival"] = hours.get("is_open_at_arrival")
        new_poi["queue_level"] = self._queue_level(queue)
        new_poi["estimated_wait_minutes"] = self._number_or_none(
            queue.get("waiting_minutes"),
            queue.get("wait_minutes"),
            queue.get("estimated_wait_minutes"),
        )
        current_price = self._number_or_none(price.get("current_price"))
        if current_price is not None:
            new_poi["current_price"] = current_price
        new_poi["estimated_total_for_family"] = self._family_total(price, new_poi, {})
        new_poi["booking_status"] = self._text(booking.get("status"), "unknown")
        return new_poi

    def _provider_candidates(self, context: ReplanContext) -> list[dict[str, Any]]:
        execution_context = self._dict(context.get("execution_context"))
        cards = self._list(execution_context.get("cards"))
        current_ids = {
            self._text(self._dict(self._dict(card).get("poi")).get("poi_id"), "")
            for card in cards
        }
        candidates: list[dict[str, Any]] = []
        for poi in self.catalog.list_pois():
            poi_id = self._text(poi.get("poi_id"), "")
            if not poi_id or poi_id in current_ids:
                continue
            candidates.append(
                {
                    "poi_id": poi_id,
                    "poi": poi,
                    "hours": self.catalog.get_hours(poi_id),
                    "price": self.catalog.get_price(poi_id),
                    "queue": self.catalog.get_queue(poi_id),
                    "booking": self.catalog.get_booking(poi_id),
                }
            )
        return candidates[:8]

    def _mock_llm_output(self, context: ReplanContext) -> str:
        current_card = self._current_card(context)
        current_poi = self._dict(current_card.get("poi"))
        target = self._best_candidate(context)
        risk_type = self._text(context.get("risk_type"), "NONE")
        strategy = self._strategy_for_risk(risk_type)
        reason = self._reason_for_risk(risk_type)
        old_name = self._text(current_poi.get("name"), "current place")
        new_name = self._text(target.get("name"), "alternative place")
        payload = {
            "strategy": strategy,
            "reason": reason,
            "proposal_summary": f"Replace {old_name} with {new_name}",
            "target_poi_id": self._text(target.get("poi_id"), self._text(current_poi.get("poi_id"), "")),
        }
        return json.dumps(payload, ensure_ascii=False)

    def _best_candidate(self, context: ReplanContext) -> dict[str, Any]:
        candidates = self._provider_candidates(context)
        if not candidates:
            return {}
        risk_type = self._text(context.get("risk_type"), "")
        if risk_type == "WEATHER_RISK":
            for candidate in candidates:
                poi = self._dict(candidate.get("poi"))
                if bool(poi.get("is_indoor")):
                    return poi
        if risk_type == "PRICE_RISK":
            return self._dict(min(candidates, key=self._candidate_price_key).get("poi"))
        if risk_type == "QUEUE_RISK":
            return self._dict(min(candidates, key=self._candidate_queue_key).get("poi"))
        if risk_type in {"CLOSED_RISK", "BOOKING_RISK"}:
            return self._dict(max(candidates, key=self._candidate_score_key).get("poi"))
        return self._dict(candidates[0].get("poi"))

    def _candidate_price_key(self, candidate: dict[str, Any]) -> float:
        price = self._dict(candidate.get("price"))
        poi = self._dict(candidate.get("poi"))
        return self._family_total(price, poi, {})

    def _candidate_queue_key(self, candidate: dict[str, Any]) -> float:
        queue = self._dict(candidate.get("queue"))
        wait = self._number_or_none(
            queue.get("waiting_minutes"),
            queue.get("wait_minutes"),
            queue.get("estimated_wait_minutes"),
        )
        return wait if wait is not None else 999.0

    def _candidate_score_key(self, candidate: dict[str, Any]) -> float:
        poi = self._dict(candidate.get("poi"))
        price = self._dict(candidate.get("price"))
        queue = self._dict(candidate.get("queue"))
        score = self._number(poi.get("rating"), 4.0) * 10
        score -= self._candidate_queue_key({"queue": queue}) / 10
        score -= self._candidate_price_key({"price": price, "poi": poi}) / 100
        return score

    def _strategy_for_risk(self, risk_type: str) -> str:
        mapping = {
            "WEATHER_RISK": "INDOOR_FALLBACK",
            "CLOSED_RISK": "ALTERNATIVE_POI",
            "BOOKING_RISK": "ALTERNATIVE_POI",
            "QUEUE_RISK": "SHORTER_WAIT",
            "PRICE_RISK": "BUDGET_FRIENDLY",
        }
        return mapping.get(risk_type, "CONTINUE")

    def _reason_for_risk(self, risk_type: str) -> str:
        return {
            "WEATHER_RISK": "LLM chooses an indoor fallback for weather risk.",
            "CLOSED_RISK": "LLM chooses an alternative POI for a closure risk.",
            "BOOKING_RISK": "LLM chooses an alternative POI for a booking risk.",
            "QUEUE_RISK": "LLM chooses a shorter-wait alternative.",
            "PRICE_RISK": "LLM chooses a budget-friendly alternative.",
        }.get(risk_type, "LLM keeps the current plan.")

    def _empty_proposal(
        self,
        context: ReplanContext,
        risk_type: str,
        reason: str,
        old_card_id: str | None = None,
        old_poi_id: str | None = None,
        old_poi: dict[str, Any] | None = None,
        strategy: str | None = None,
    ) -> Proposal:
        current_card = self._current_card(context)
        resolved_old_card_id = (
            old_card_id
            or self._text(current_card.get("card_id"), "")
            or self._text(context.get("current_card_id"), "")
            or None
        )
        resolved_old_poi = deepcopy(old_poi) if isinstance(old_poi, dict) else {}
        if not resolved_old_poi:
            resolved_old_poi = deepcopy(self._dict(current_card.get("poi")))
        resolved_old_poi_id = (
            old_poi_id or self._text(resolved_old_poi.get("poi_id"), "") or None
        )
        return {
            "replanned": False,
            "strategy": self._text(strategy, self._text(context.get("strategy"), "CONTINUE")),
            "risk_type": risk_type,
            "reason": reason,
            "proposal_summary": reason,
            "old_poi": resolved_old_poi,
            "new_poi": {},
            "requires_user_confirmation": True,
            "old_card_id": resolved_old_card_id,
            "old_poi_id": resolved_old_poi_id,
        }

    def _current_card(self, context: ReplanContext) -> dict[str, Any]:
        execution_context = self._dict(context.get("execution_context"))
        cards = self._list(execution_context.get("cards"))
        current_card_id = self._text(context.get("current_card_id"), "")
        risk_poi_id = self._risk_poi_id(context)

        if risk_poi_id:
            for card in cards:
                if self._text(self._dict(card).get("poi", {}).get("poi_id"), "") == risk_poi_id:
                    return self._dict(card)
        for card in cards:
            if isinstance(card, dict) and card.get("card_id") == current_card_id:
                return card
        for card in cards:
            if isinstance(card, dict) and card.get("status") == "active":
                return card
        for card in cards:
            if isinstance(card, dict):
                return card
        return {}

    def _risk_poi_id(self, context: ReplanContext) -> str:
        risk_flags = self._list(context.get("risk_flags"))
        risk_type = self._text(context.get("risk_type"), "")
        for risk in risk_flags:
            if not isinstance(risk, dict) or risk.get("type") != risk_type:
                continue
            poi_id = self._text(risk.get("poi_id"), "")
            if poi_id:
                return poi_id
        return ""

    def _family_total(
        self,
        price: dict[str, Any],
        poi: dict[str, Any],
        constraints: dict[str, Any],
    ) -> float:
        total = self._number_or_none(
            price.get("current_price"),
            price.get("estimated_total_for_family"),
        )
        if total is not None:
            return max(0.0, total)
        party_size = max(
            1,
            round(
                self._number(constraints.get("adults"), 2)
                + self._number(constraints.get("children"), 1)
            ),
        )
        avg_price = self._number_or_none(price.get("avg_price"))
        if avg_price is None:
            avg_price = self._number_or_none(poi.get("price_per_person"))
        return max(0.0, (avg_price or 0.0) * party_size)

    def _queue_level(self, queue: dict[str, Any]) -> str:
        level = self._text(
            queue.get("status"),
            self._text(queue.get("queue_level"), ""),
        ).lower()
        if level in {"low", "medium", "high", "unknown"}:
            return level
        wait_minutes = self._number_or_none(
            queue.get("waiting_minutes"),
            queue.get("wait_minutes"),
            queue.get("estimated_wait_minutes"),
        )
        if wait_minutes is None:
            return "unknown"
        if wait_minutes <= 10:
            return "low"
        if wait_minutes <= 25:
            return "medium"
        return "high"

    def _dict(self, value: Any) -> dict[str, Any]:
        return value if isinstance(value, dict) else {}

    def _list(self, value: Any) -> list[Any]:
        return value if isinstance(value, list) else []

    def _text(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default

    def _number(self, value: Any, default: float) -> float:
        parsed = self._number_or_none(value)
        return default if parsed is None else parsed

    def _number_or_none(self, *values: Any) -> float | None:
        for value in values:
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
        return None

    def _mock_mode(self) -> bool:
        return bool(settings.llm_replanner_mock)
