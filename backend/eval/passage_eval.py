"""Passage-level retrieval evaluation: does a retrieved chunk contain the answer, not only the right document?

Run from backend/:  python -m eval.passage_eval
Uses the answerable questions from all four chat question files. A question counts as answered at rank r if the
r-th retrieved chunk comes from an expected document AND contains every `must_match` answer pattern. This is a
criterion-level check: the document-level eval (retrieval_eval.py) counts any chunk of the right document.
Queries are the question text as written (the chatbot rewrites its own queries, so this is an upper-bound-style
check of the index, not of the chatbot). An answer split across two chunks counts as a miss, so this is strict.
No LLM calls. Results: eval/results/passage_eval.json.
"""
import json
import sys
from pathlib import Path

from eval.chat_eval import norm
from rag import store

HERE = Path(__file__).resolve().parent
FILES = ["chat_questions.json", "chat_questions_heldout.json", "chat_questions_set3.json", "chat_questions_set4.json"]
KS = (1, 3, 4, 5, 10)
DEPTH = 20


def load():
    out = []
    for f in FILES:
        for q in json.loads((HERE / f).read_text()):
            if q["answerable"]:
                out.append({**q, "set": f})
    return out


def answers(q: dict, hit: dict) -> bool:
    import re
    title = (hit["title"] or "").lower()
    if not any(s.lower() in title for s in q["expected_sources"]):
        return False
    text = norm(hit["text"])
    return all(re.search(p, text, re.I) for p in q["must_match"])


def rank_of(q: dict, use_filter: bool) -> tuple[int | None, int | None]:
    hits = store.search(q["question"], k=DEPTH, payer=q["payer"] if use_filter else None)
    doc = next((i + 1 for i, h in enumerate(hits) if any(s.lower() in (h["title"] or "").lower() for s in q["expected_sources"])), None)
    passage = next((i + 1 for i, h in enumerate(hits) if answers(q, h)), None)
    return doc, passage


def summarize(ranks: list) -> dict:
    n = len(ranks)
    out = {f"recall@{k}": round(sum(r is not None and r <= k for r in ranks) / n, 3) for k in KS}
    out["mrr@20"] = round(sum(1 / r for r in ranks if r) / n, 3)
    out["n"] = n
    return out


if __name__ == "__main__":
    print(f"Indexed {store.ingest()} chunks", file=sys.stderr)
    qs = load()
    report, rows = {}, []
    for flag in (True, False):
        doc_ranks, passage_ranks = [], []
        for q in qs:
            d, p = rank_of(q, flag)
            doc_ranks.append(d)
            passage_ranks.append(p)
            if flag:
                rows.append({"id": q["id"], "set": q["set"], "payer": q["payer"], "doc_rank": d, "passage_rank": p})
        report[f"payer_filter={flag}"] = {"document": summarize(doc_ranks), "passage": summarize(passage_ranks)}
    by_payer = {}
    for r in rows:
        by_payer.setdefault(r["payer"], []).append(r["passage_rank"])
    report["passage_by_payer_filter_on"] = {p: summarize(v) for p, v in sorted(by_payer.items())}
    report["rows_filter_on"] = rows
    (HERE / "results").mkdir(exist_ok=True)
    (HERE / "results" / "passage_eval.json").write_text(json.dumps(report, indent=1))
    print(json.dumps({k: v for k, v in report.items() if k != "rows_filter_on"}, indent=1))
