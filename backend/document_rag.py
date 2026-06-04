"""
document_rag.py - Claude-style long document handling via chunking + relevance selection.
"""
import json
import math
import re
from pathlib import Path

CHUNK_SIZE = 2_400
CHUNK_OVERLAP = 280
INLINE_FULL_CHAR_LIMIT = 62_000


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            break_at = text.rfind("\n\n", start, end)
            if break_at > start + size // 3:
                end = break_at
            else:
                break_at = text.rfind("\n", start, end)
                if break_at > start + size // 3:
                    end = break_at
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)

    return chunks


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]{2,}", (text or "").lower()))


def _score_chunk(query: str, chunk: str) -> float:
    q = _tokens(query)
    if not q:
        return 0.0
    c = _tokens(chunk)
    if not c:
        return 0.0
    overlap = len(q & c)
    if overlap == 0:
        return 0.0
    return overlap / math.sqrt(len(q)) + 0.15 * (overlap / max(len(c), 1))


def select_context_text(
    full_text: str,
    user_query: str,
    char_budget: int,
    *,
    filename: str = "document",
) -> tuple[str, dict]:
    """
    Return text to inject into the model prompt and metadata about coverage.
    Small docs: full text. Large docs: query-relevant chunks (RAG-style).
    """
    meta = {
        "filename": filename,
        "total_chars": len(full_text),
        "mode": "full",
        "chunks_used": 0,
        "chunks_total": 0,
    }
    if not full_text.strip():
        return "", meta

    if len(full_text) <= min(char_budget, INLINE_FULL_CHAR_LIMIT):
        meta["mode"] = "full"
        return full_text, meta

    chunks = chunk_text(full_text)
    meta["chunks_total"] = len(chunks)
    if not chunks:
        return "", meta

    if len(chunks) == 1 or sum(len(c) for c in chunks) <= char_budget:
        meta["mode"] = "full"
        meta["chunks_used"] = len(chunks)
        joined = "\n\n---\n\n".join(chunks)
        if len(joined) > char_budget:
            return joined[:char_budget] + "\n…", meta
        return joined, meta

    meta["mode"] = "excerpts"
    query = (user_query or "").strip()
    scored = [(i, _score_chunk(query, c), c) for i, c in enumerate(chunks)]

    if query:
        scored.sort(key=lambda x: x[1], reverse=True)
        picked_indices: list[int] = []
        used = 0
        for idx, _score, chunk in scored:
            if _score <= 0 and len(picked_indices) >= 4:
                continue
            need = len(chunk) + 80
            if used + need > char_budget and picked_indices:
                break
            picked_indices.append(idx)
            used += need
            if used >= char_budget:
                break
        if len(picked_indices) < 3:
            for idx in range(min(3, len(chunks))):
                if idx not in picked_indices:
                    picked_indices.append(idx)
    else:
        # Generic prompts ("solve this", "summarize") — spread across document
        n = len(chunks)
        picks = {0, n - 1}
        if n > 2:
            picks.add(n // 2)
        step = max(1, n // 8)
        for i in range(0, n, step):
            picks.add(i)
        picked_indices = sorted(picks)[:12]

    picked_indices = sorted(set(picked_indices))
    parts: list[str] = []
    used_chars = 0
    for idx in picked_indices:
        chunk = chunks[idx]
        header = f"[Excerpt {idx + 1}/{len(chunks)}]"
        block = f"{header}\n{chunk}"
        if used_chars + len(block) > char_budget:
            remain = char_budget - used_chars - len(header) - 20
            if remain > 200:
                parts.append(f"{header}\n{chunk[:remain]}…")
            break
        parts.append(block)
        used_chars += len(block)

    meta["chunks_used"] = len(parts)
    notice = (
        f"(Document '{filename}' has {len(full_text):,} characters in {len(chunks)} sections. "
        f"Showing {len(parts)} most relevant sections for this question. "
        "Answer from these excerpts; say if the user may need to specify a section.)\n\n"
    )
    body = notice + "\n\n---\n\n".join(parts)
    return body, meta


def save_chunks_index(path: Path, chunks: list[str]) -> None:
    path.write_text(
        json.dumps({"chunks": chunks}, ensure_ascii=False),
        encoding="utf-8",
    )


def load_chunks_index(path: Path) -> list[str]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        chunks = data.get("chunks", [])
        return chunks if isinstance(chunks, list) else []
    except Exception:
        return []
