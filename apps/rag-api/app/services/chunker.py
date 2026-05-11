from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class Chunk:
    text: str
    chunk_index: int


class TextChunker:
    def __init__(self, chunk_size: int = 900, chunk_overlap: int = 150, min_chunk_chars: int = 200) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_chars = min_chunk_chars

    def split(self, text: str) -> list[Chunk]:
        normalized = " ".join(text.split())
        if not normalized:
            return []

        chunks: list[Chunk] = []
        start = 0
        index = 0
        text_length = len(normalized)
        while start < text_length:
            end = min(start + self.chunk_size, text_length)
            window = normalized[start:end]

            if end < text_length:
                pivot = window.rfind(". ")
                if pivot > self.min_chunk_chars:
                    end = start + pivot + 1
                    window = normalized[start:end]

            if len(window) >= self.min_chunk_chars or not chunks:
                chunks.append(Chunk(text=window.strip(), chunk_index=index))
                index += 1

            if end >= text_length:
                break

            start = max(end - self.chunk_overlap, start + 1)

        return chunks
