from __future__ import annotations


def scrub_error(message: str) -> str:
    return " ".join(message.strip().split())
