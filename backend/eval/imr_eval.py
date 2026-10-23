"""Real-denial test: California DMHC Independent Medical Review (IMR) decisions.

Open data: https://data.chhs.ca.gov (dataset "Independent Medical Review (IMR) Determinations, Trend").
Download:  python -m eval.imr_eval --download      then:  python -m eval.imr_eval

For every real review whose request was an MRI of the lumbar spine, the query is the case
description (the first sentences of the reviewer's case summary, cut before any reasoning), and
we ask whether retrieval surfaces a spine-MRI policy from our corpus (Aetna CPB 0236 or BCBS CAM 709).
Relevance is topic-level (these two documents are the spine-imaging policies in the corpus), not
passage-level, and was fixed before running. The payer is unknown, so search is unfiltered.
"""
import argparse
import csv
import json
import re
import subprocess
from pathlib import Path

from rag import store

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "imr.csv"
URL = ("https://data.chhs.ca.gov/dataset/b79b3447-4c10-4ae6-84e2-1076f83bb24e/resource/"
       "3340c5d7-4054-4d03-90e0-5f44290ed095/download/independent-medical-review-imr-determinations-trends.csv")
RELEVANT = ("CPB 0236", "CAM 709")
REQUEST = re.compile(r"requested[^.]{0,60}?(?:authorization|coverage|approval)[^.]{0,80}?(?:MRI|magnetic resonance)"
                     r"[^.]{0,80}?(?:lumbar|lumbosacral|L[1-5]|low back)", re.I)
REASONING = re.compile(r"\b(?:criteria|guideline|indicat|appropriate|medically necessary|not medically)", re.I)
KS = (1, 3, 5)


def case_summary(findings: str) -> str:
    m = re.search(r"Case Summary:\s*(.*?)(?:Final Result|$)", findings, re.S)
    return (m.group(1) if m else findings).strip()


def query_from(summary: str) -> str:
    """Clinical description only: sentences up to the first one that starts to state reasoning."""
    kept = []
    for s in re.split(r"(?<=[.!?])\s+", summary):
        if kept and REASONING.search(s):
            break
        kept.append(s)
        if len(" ".join(kept)) > 350:
            break
    return " ".join(kept)[:500]


def load_cases():
    with open(CSV_PATH, encoding="utf-8-sig", errors="ignore") as f:
        rows = list(csv.DictReader(f))
    return [r for r in rows if REQUEST.search(case_summary(r["Findings"]))]


def main():
    cases = load_cases()
    overturned = sum(r["Determination"].startswith("Overturned") for r in cases)
    ranks = []
    for r in cases:
        hits = store.search(query_from(case_summary(r["Findings"])), k=max(KS))
        ranks.append(next((i + 1 for i, h in enumerate(hits) if any(t in (h["title"] or "") for t in RELEVANT)), None))
    n = len(cases)
    col = store._get_collection()
    titles = [m["title"] for m in col.get(include=["metadatas"])["metadatas"]]
    share = sum(any(t in x for t in RELEVANT) for x in titles) / len(titles)
    out = {f"hit@{k}": round(sum(r is not None and r <= k for r in ranks) / n, 3) for k in KS}
    out.update({"n_cases": n, "denials_overturned": f"{overturned}/{n} ({overturned / n:.0%})",
                "share_of_chunks_that_are_relevant": round(share, 3),
                "random_hit@5_approx": round(1 - (1 - share) ** 5, 3)})
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true")
    if ap.parse_args().download:
        CSV_PATH.parent.mkdir(exist_ok=True)
        subprocess.run(["curl", "-sfL", "-m", "300", "-o", str(CSV_PATH), URL], check=True)
        print(f"saved {CSV_PATH}")
    else:
        main()
