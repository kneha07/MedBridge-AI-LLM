"""Retrieval ablation: chunk size and overlap, with and without the payer filter.

Run from backend/:  python -m eval.ablation_eval
Uses an in-memory index per configuration (the real index in rag/.chroma is not touched) and the
same hand-written queries as eval.retrieval_eval (document level), plus the 69 answerable chat questions scored at
passage level (eval.passage_eval: the retrieved chunk must contain the answer; payer filter on). Larger chunks are
favoured by the passage metric because an answer is less often split across two chunks.
"""
import json

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from eval import passage_eval
from eval.retrieval_eval import QUERIES, evaluate
from rag import store

CONFIGS = [(80, 15), (160, 30), (320, 60), (640, 120), (160, 0)]  # (chunk words, overlap words)


def main():
    real_chunk, real_col = store.chunk_text, store._collection
    ef = SentenceTransformerEmbeddingFunction(model_name=store.EMBED_MODEL)
    client = chromadb.EphemeralClient()
    report = {}
    try:
        for size, overlap in CONFIGS:
            store.chunk_text = lambda text, s=size, o=overlap: real_chunk(text, s, o)
            store._collection = client.create_collection(f"abl_{size}_{overlap}", embedding_function=ef,
                                                         metadata={"hnsw:space": "cosine"})
            n = store.ingest(reset=False)
            for flag in (True, False):
                res, _ = evaluate(QUERIES, flag)
                report[f"chunk={size},overlap={overlap},payer_filter={flag}"] = {"chunks": n, **res}
            ranks = [passage_eval.rank_of(q, True)[1] for q in passage_eval.load()]
            report[f"chunk={size},overlap={overlap},passage_level"] = {"chunks": n, **passage_eval.summarize(ranks)}
    finally:
        store.chunk_text, store._collection = real_chunk, real_col
    (passage_eval.HERE / "results" / "retrieval_ablation.json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
