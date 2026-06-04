from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, dataclass
from typing import Any


ApplyReplanRecord = dict[str, Any]


@dataclass(frozen=True)
class ApplyReplanInput:
    plan: Any
    proposal: ApplyReplanRecord


@dataclass(frozen=True)
class ApplyReplanResult:
    applied: bool
    old_poi_id: str | None = None
    new_poi_id: str | None = None
    updated_plan: ApplyReplanRecord | None = None
    reason: str | None = None


class ApplyReplanService:
    def apply(self, payload: ApplyReplanInput) -> ApplyReplanRecord:
        proposal = self._dict(payload.proposal)
        if not bool(proposal.get("replanned")):
            return asdict(ApplyReplanResult(applied=False))

        new_poi = self._dict(proposal.get("new_poi"))
        if not new_poi:
            return asdict(
                ApplyReplanResult(
                    applied=False,
                    reason="missing_new_poi",
                )
            )

        plan = self._plan_dict(payload.plan)
        plan_copy = deepcopy(plan)
        cards = self._list(plan_copy.get("cards"))

        old_card_id = self._text(proposal.get("old_card_id"), "")
        old_poi_id = self._text(proposal.get("old_poi_id"), "")
        target_index = self._find_target_card(cards, old_card_id, old_poi_id)
        if target_index is None:
            return asdict(
                ApplyReplanResult(
                    applied=False,
                    old_poi_id=old_poi_id or None,
                    new_poi_id=self._text(new_poi.get("poi_id"), "") or None,
                    reason="card_not_found",
                )
            )

        target_card = deepcopy(self._dict(cards[target_index]))
        updated_card = self._apply_card_replacement(target_card, new_poi, proposal)
        cards[target_index] = updated_card
        plan_copy["cards"] = cards

        return asdict(
            ApplyReplanResult(
                applied=True,
                old_poi_id=old_poi_id or self._poi_id_from_card(target_card),
                new_poi_id=self._text(new_poi.get("poi_id"), "") or None,
                updated_plan=plan_copy,
            )
        )

    def _apply_card_replacement(
        self,
        card: ApplyReplanRecord,
        new_poi: ApplyReplanRecord,
        proposal: ApplyReplanRecord,
    ) -> ApplyReplanRecord:
        poi = self._dict(card.get("poi"))
        merged_poi = deepcopy(poi)
        merged_poi.update(deepcopy(new_poi))

        poi_id = self._text(merged_poi.get("poi_id"), self._text(new_poi.get("poi_id"), "unknown"))
        name = self._text(merged_poi.get("name"), self._text(new_poi.get("name"), "未知地点"))
        category = self._text(
            merged_poi.get("category"),
            self._text(new_poi.get("category"), "未知类型"),
        )

        merged_poi["poi_id"] = poi_id
        merged_poi["name"] = name
        merged_poi["category"] = category
        merged_poi["recommendation_reason"] = self._text(
            new_poi.get("recommendation_reason"),
            self._text(proposal.get("reason"), self._text(proposal.get("proposal_summary"), "")),
        )
        merged_poi["risk_labels"] = self._list(merged_poi.get("risk_labels"))

        card["poi"] = merged_poi
        card["label"] = f"{name} · {category}"
        card["risk_note"] = self._text(
            proposal.get("reason"),
            self._text(proposal.get("proposal_summary"), self._text(card.get("risk_note"), "")),
        )

        provider_snapshot = card.get("provider_snapshot")
        if isinstance(provider_snapshot, dict):
            card["provider_snapshot"] = self._sync_provider_snapshot(provider_snapshot, new_poi)

        return card

    def _sync_provider_snapshot(
        self,
        snapshot: ApplyReplanRecord,
        new_poi: ApplyReplanRecord,
    ) -> ApplyReplanRecord:
        updated = deepcopy(snapshot)
        for key in [
            "poi_id",
            "name",
            "category",
            "is_indoor",
            "queue_level",
            "booking_status",
            "hours_label",
            "queue_minutes",
            "estimated_wait_minutes",
            "estimated_total_for_family",
            "price_per_person",
            "source",
            "confidence",
            "fallback_reason",
            "is_open_at_arrival",
            "rating",
            "address",
            "district",
            "latitude",
            "longitude",
            "tags",
        ]:
            if key in new_poi:
                updated[key] = deepcopy(new_poi.get(key))
        return updated

    def _find_target_card(
        self,
        cards: list[Any],
        old_card_id: str,
        old_poi_id: str,
    ) -> int | None:
        if old_card_id:
            for index, card in enumerate(cards):
                if self._text(self._dict(card).get("card_id"), "") == old_card_id:
                    return index
        if old_poi_id:
            for index, card in enumerate(cards):
                poi = self._dict(self._dict(card).get("poi"))
                if self._text(poi.get("poi_id"), "") == old_poi_id:
                    return index
        return None

    def _poi_id_from_card(self, card: ApplyReplanRecord) -> str:
        return self._text(self._dict(card.get("poi")).get("poi_id"), "")

    def _plan_dict(self, plan: Any) -> ApplyReplanRecord:
        if hasattr(plan, "model_dump"):
            return deepcopy(plan.model_dump(mode="json"))
        if isinstance(plan, dict):
            return deepcopy(plan)
        return deepcopy(self._dict(plan))

    def _dict(self, value: Any) -> ApplyReplanRecord:
        return value if isinstance(value, dict) else {}

    def _list(self, value: Any) -> list[Any]:
        return value if isinstance(value, list) else []

    def _text(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default
