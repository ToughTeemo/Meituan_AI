from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class DeepSeekClientError(RuntimeError):
    pass


@dataclass(frozen=True)
class DeepSeekClientConfig:
    api_key: str | None
    base_url: str = "https://api.deepseek.com"
    model: str = "deepseek-chat"
    timeout_seconds: float = 20.0


class DeepSeekClient:
    def __init__(self, config: DeepSeekClientConfig) -> None:
        self.config = config

    def complete_json(self, system_prompt: str, user_prompt: str) -> str:
        api_key = self._text(self.config.api_key, "")
        if not api_key:
            raise DeepSeekClientError("missing_api_key")

        payload = {
            "model": self._text(self.config.model, "deepseek-chat"),
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 512,
            "response_format": {"type": "json_object"},
        }

        request = Request(
            self._chat_completions_url(),
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.config.timeout_seconds) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8") if exc.fp else ""
            except Exception:
                body = ""
            raise DeepSeekClientError(
                f"http_error:{exc.code}:{body[:200]}"
            ) from exc
        except (OSError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise DeepSeekClientError(f"request_error:{type(exc).__name__}") from exc

        choices = response_payload.get("choices")
        if not isinstance(choices, list) or not choices:
            raise DeepSeekClientError("invalid_response:choices")

        first_choice = choices[0]
        message = first_choice.get("message") if isinstance(first_choice, dict) else {}
        content = message.get("content") if isinstance(message, dict) else ""
        if not isinstance(content, str) or not content.strip():
            raise DeepSeekClientError("invalid_response:content")
        return content

    def _chat_completions_url(self) -> str:
        return self._base_url().rstrip("/") + "/chat/completions"

    def _base_url(self) -> str:
        base_url = self._text(self.config.base_url, "https://api.deepseek.com")
        return base_url

    def _text(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default
