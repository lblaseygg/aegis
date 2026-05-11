from app.services.chunker import TextChunker


def test_chunker_splits_long_text() -> None:
    chunker = TextChunker(chunk_size=60, chunk_overlap=10, min_chunk_chars=20)
    text = " ".join(["alpha bravo charlie delta echo"] * 20)
    chunks = chunker.split(text)
    assert len(chunks) >= 2
    assert chunks[0].chunk_index == 0
    assert all(len(chunk.text) >= 20 for chunk in chunks)
