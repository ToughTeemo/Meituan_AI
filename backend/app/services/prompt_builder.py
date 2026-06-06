from __future__ import annotations

import json
from string import Template
from typing import Any


class PromptBuilder:
    def render(self, template: str, variables: dict[str, Any]) -> str:
        rendered_variables = {
            key: self._stringify(value) for key, value in variables.items()
        }
        return Template(template).safe_substitute(rendered_variables)

    def _stringify(self, value: Any) -> str:
        if isinstance(value, str):
            return value
        if value is None:
            return ""
        if isinstance(value, (bool, int, float)):
            return json.dumps(value, ensure_ascii=False)
        return json.dumps(value, ensure_ascii=False, indent=2)
