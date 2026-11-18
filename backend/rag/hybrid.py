"""Keyword (BM25) ranking and rank fusion, used by rag.store.search when RAG_HYBRID=1.

Dense embeddings miss passages whose wording differs from the query but share exact terms
(policy numbers, "pseudarthrosis", week counts); BM25 catches those. The two rankings are
merged with reciprocal rank fusion, which needs no score calibration. Pure Python, no new
dependencies: the corpus is a few hundred chunks.
"""
import math
import re
from collections import Counter

_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = frozenset("a an and are as at be by for from in is it of on or that the to with".split())


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP]


class BM25:
    """Okapi BM25 over a fixed list of documents."""

    def __init__(self, docs: list[str], k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        self.tfs = [Counter(tokenize(d)) for d in docs]
        self.lens = [sum(tf.values()) for tf in self.tfs]
        self.avg_len = (sum(self.lens) / len(self.lens)) if self.lens else 0.0
        df = Counter(term for tf in self.tfs for term in tf)
        n = len(docs)
        self.idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}

    def scores(self, query: str) -> list[float]:
        terms = [t for t in tokenize(query) if t in self.idf]
        out = []
        for tf, length in zip(self.tfs, self.lens):
            norm = self.k1 * (1 - self.b + self.b * length / self.avg_len) if self.avg_len else self.k1
            out.append(sum(self.idf[t] * tf[t] * (self.k1 + 1) / (tf[t] + norm) for t in terms if tf[t]))
        return out

    def rank(self, query: str, n: int) -> list[int]:
        """Indices of the top-n documents with a non-zero score, best first."""
        scored = [(s, i) for i, s in enumerate(self.scores(query)) if s > 0]
        scored.sort(key=lambda p: (-p[0], p[1]))
        return [i for _, i in scored[:n]]


def rrf(rankings: list[list], k: int = 60) -> list:
    """Reciprocal rank fusion: merge ranked lists of ids into one list, best first."""
    score: dict = {}
    for ranking in rankings:
        for pos, item in enumerate(ranking):
            score[item] = score.get(item, 0.0) + 1.0 / (k + pos + 1)
    first_seen = {}
    for ranking in rankings:
        for item in ranking:
            first_seen.setdefault(item, len(first_seen))
    return sorted(score, key=lambda item: (-score[item], first_seen[item]))
