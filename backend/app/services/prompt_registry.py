from __future__ import annotations

from dataclasses import dataclass
from importlib import resources

from app.core.config import settings


@dataclass(frozen=True)
class PromptSpec:
    version: str
    text: str


class PromptRegistry:
    def __init__(self, package: str = "app.prompts") -> None:
        self.package = package
        self._replan_prompts = {
            "v1": "replan_v1.txt",
        }

    def get_replan_prompt(self, version: str | None = None) -> PromptSpec:
        resolved_version = self._resolve_version(version)
        filename = self._replan_prompts.get(resolved_version)
        if filename is None:
            raise ValueError(f"Unsupported REPLAN_PROMPT_VERSION: {resolved_version}")

        prompt_text = self._read_text(filename)
        return PromptSpec(version=resolved_version, text=prompt_text)

    def _resolve_version(self, version: str | None) -> str:
        candidate = version if version is not None else settings.replan_prompt_version
        if not isinstance(candidate, str) or not candidate.strip():
            return "v1"
        return candidate.strip().lower()

    def _read_text(self, filename: str) -> str:
        prompt_path = resources.files(self.package).joinpath(filename)
        return prompt_path.read_text(encoding="utf-8")
