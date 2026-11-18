"""RAG store: chunk policy documents, embed them, and retrieve with ChromaDB.

Documents come from rag/corpus/*.md|*.txt (public payer / CMS policy text, see
rag/build_corpus.py). Each chunk keeps its source, payer and title so answers can cite them.
"""
import hashlib
import os
import re
from pathlib import Path

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from rag.hybrid import BM25, rrf

CORPUS_DIR = Path(__file__).parent / "corpus"
DB_DIR = Path(__file__).parent / ".chroma"
COLLECTION = "policies"
EMBED_MODEL = "all-MiniLM-L6-v2"
CHUNK_WORDS = 160
OVERLAP_WORDS = 30
# Experiment, off by default: RAG_HYBRID=1 merges the embedding ranking with a keyword (BM25) ranking.
HYBRID = os.environ.get("RAG_HYBRID", "0") == "1"
HYBRID_DEPTH = 20  # candidates taken from each ranking before fusion

_collection = None


def _get_collection():
    global _collection
    if _collection is None:
        client = chromadb.PersistentClient(path=str(DB_DIR))
        _collection = client.get_or_create_collection(
            COLLECTION,
            embedding_function=SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL),
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def chunk_text(text: str, size: int = CHUNK_WORDS, overlap: int = OVERLAP_WORDS) -> list[str]:
    """Split on paragraphs, then pack into ~size-word windows with overlap."""
    words = " ".join(p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()).split()
    if len(words) <= size:
        return [" ".join(words)] if words else []
    chunks, step = [], size - overlap
    for start in range(0, len(words), step):
        chunks.append(" ".join(words[start:start + size]))
        if start + size >= len(words):
            break
    return chunks


def _parse_front_matter(text: str) -> tuple[dict, str]:
    """Optional `key: value` header lines terminated by a `---` line."""
    meta = {}
    if text.startswith("---"):
        _, header, body = text.split("---", 2)
        for line in header.strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        return meta, body.strip()
    return meta, text


def _corpus_docs() -> list[dict]:
    docs = []
    for path in sorted(CORPUS_DIR.glob("*")):
        if path.suffix.lower() not in {".md", ".txt"}:
            continue
        meta, body = _parse_front_matter(path.read_text(encoding="utf-8"))
        meta.setdefault("source", path.name)
        meta.setdefault("title", path.stem.replace("_", " "))
        meta.setdefault("payer", "General")
        meta["synthetic"] = meta.get("synthetic", "false").lower() == "true"
        docs.append({"id": path.stem, "text": body, "meta": meta})
    return docs


def ingest(reset: bool = True) -> int:
    """(Re)build the index. Returns the number of chunks stored."""
    col = _get_collection()
    if reset:
        existing = col.get()["ids"]
        if existing:
            col.delete(ids=existing)
    ids, texts, metas = [], [], []
    for doc in _corpus_docs():
        for i, chunk in enumerate(chunk_text(doc["text"])):
            ids.append(hashlib.md5(f"{doc['id']}-{i}".encode()).hexdigest())
            texts.append(chunk)
            metas.append({**doc["meta"], "chunk": i})
    if ids:
        col.upsert(ids=ids, documents=texts, metadatas=metas)
    return len(ids)


def _canonical_payer(col, payer: str | None) -> str | None:
    """Map free-text payer names ("UnitedHealthcare", "bcbs") onto the names stored in the index; None if unknown."""
    if not payer:
        return None
    key = re.sub(r"[^a-z0-9]", "", payer.lower())
    key = {"bcbs": "bluecrossblueshield", "uhc": "unitedhealthcare", "uhg": "unitedhealthcare"}.get(key, key)
    known = {m["payer"] for m in col.get(include=["metadatas"])["metadatas"]} - {"General"}
    for name in known:
        k = re.sub(r"[^a-z0-9]", "", name.lower())
        if key == k or (len(key) >= 4 and (key in k or k in key)):
            return name
    return None


def search(query: str, k: int = 4, payer: str | None = None) -> list[dict]:
    """Return top-k chunks as {text, source, title, payer, score}. Builds the index on first use."""
    col = _get_collection()
    if col.count() == 0:
        ingest(reset=False)
    if payer:
        payer = _canonical_payer(col, payer)
        if payer is None:  # a payer we hold no documents for: never answer from another payer's policy
            return []
    where = {"payer": {"$in": [payer, "General"]}} if payer else None
    if HYBRID:
        return _hybrid_search(col, query, k, where)
    res = col.query(query_texts=[query], n_results=k, where=where)
    return [_hit(text, meta, round(1 - dist, 3))
            for text, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0])]


def _hit(text: str, meta: dict, score: float) -> dict:
    return {"text": text, "source": meta.get("source"), "title": meta.get("title"),
            "payer": meta.get("payer"), "synthetic": meta.get("synthetic", False), "score": score}


def _hybrid_search(col, query: str, k: int, where: dict | None) -> list[dict]:
    """Embedding and keyword (BM25) rankings over the same payer-filtered chunks, merged by rank fusion.
    `score` stays the embedding similarity, so a chunk found by its keywords can show a low score."""
    pool = col.get(where=where, include=["documents", "metadatas"])
    if not pool["ids"]:
        return []
    # The corpus is small, so the embedding query ranks every filtered chunk: each one then has a similarity.
    res = col.query(query_texts=[query], n_results=len(pool["ids"]), where=where)
    dense_ids = res["ids"][0]
    similarity = {i: round(1 - d, 3) for i, d in zip(dense_ids, res["distances"][0])}
    depth = max(HYBRID_DEPTH, k)
    keyword_ids = [pool["ids"][i] for i in BM25(pool["documents"]).rank(query, depth)]
    by_id = {i: (text, meta) for i, text, meta in zip(pool["ids"], pool["documents"], pool["metadatas"])}
    return [_hit(*by_id[i], similarity.get(i, 0.0)) for i in rrf([dense_ids[:depth], keyword_ids])[:k]]


if __name__ == "__main__":
    print(f"Indexed {ingest()} chunks")
