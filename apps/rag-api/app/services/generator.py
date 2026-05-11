from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Iterable
from urllib.error import URLError
from urllib.request import Request, urlopen

from app.services.vector_store import StoredChunk


PROMPT_TEMPLATE = """You are an offline assistant running inside a restricted environment.

Answer the user's question using only the provided context.
If the context does not contain the answer, say that the local knowledge base does not contain enough information.

Context:
{context}

Question:
{question}

Answer with:
1. Direct answer
2. Supporting source names
3. Uncertainty, if any
"""

DEFAULT_OLLAMA_TIMEOUT_SECONDS = 60
DEFAULT_OLLAMA_NUM_PREDICT = 96
DEFAULT_OLLAMA_NUM_CTX = 2048


@dataclass(slots=True)
class GeneratedAnswer:
    answer: str
    uncertainty: str | None = None


class Generator:
    def __init__(self, ollama_base_url: str) -> None:
        self.ollama_base_url = ollama_base_url.rstrip("/")

    def answer(self, question: str, model: str, chunks: Iterable[StoredChunk]) -> GeneratedAnswer:
        chunk_list = list(chunks)
        if not chunk_list:
            return GeneratedAnswer(
                answer="The local knowledge base does not contain enough information to answer that question.",
                uncertainty="No indexed context matched the query.",
            )

        context = "\n\n".join(
            f"[{chunk.metadata['file_name']}#{chunk.metadata['chunk_index']}] {chunk.text}" for chunk in chunk_list
        )
        prompt = PROMPT_TEMPLATE.format(context=context, question=question)

        try:
            response = self._call_ollama(prompt=prompt, model=model)
            return GeneratedAnswer(answer=response.strip(), uncertainty=None)
        except (URLError, TimeoutError, ValueError, OSError):
            preview = "\n".join(
                f"- {chunk.metadata['file_name']}: {chunk.text[:220].strip()}" for chunk in chunk_list[:3]
            )
            return GeneratedAnswer(
                answer=(
                    "Ollama is unavailable, so this is an extractive fallback based on the indexed context:\n"
                    f"{preview}"
                ),
                uncertainty="Generated answer fallback was used because Ollama could not be reached.",
            )

    def health(self) -> str:
        request = Request(f"{self.ollama_base_url}/api/tags", method="GET")
        try:
            with urlopen(request, timeout=2) as response:
                if response.status == 200:
                    return "ready"
        except (URLError, TimeoutError, OSError):
            return "unreachable"
        return "unhealthy"

    def _call_ollama(self, prompt: str, model: str) -> str:
        payload = json.dumps(
            {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_predict": int(os.getenv("OLLAMA_NUM_PREDICT", DEFAULT_OLLAMA_NUM_PREDICT)),
                    "num_ctx": int(os.getenv("OLLAMA_NUM_CTX", DEFAULT_OLLAMA_NUM_CTX)),
                    "temperature": 0.2,
                },
            }
        ).encode("utf-8")
        request = Request(
            f"{self.ollama_base_url}/api/generate",
            data=payload,
            method="POST",
            headers={"Content-Type": "application/json"},
        )

        timeout_seconds = float(os.getenv("OLLAMA_GENERATE_TIMEOUT_SECONDS", DEFAULT_OLLAMA_TIMEOUT_SECONDS))
        with urlopen(request, timeout=timeout_seconds) as response:
            body = json.loads(response.read().decode("utf-8"))
            answer = body.get("response")
            if not isinstance(answer, str):
                raise ValueError("Ollama response did not include generated text.")
            return answer
