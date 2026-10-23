"""Chatbot evaluation: 30 questions with known answers, with retrieval (the chatbot) vs without (plain LLM).

Run from backend/:
  python -m eval.chat_eval --check-key                      # verify every answer key against the source documents
  python -m eval.chat_eval --provider groq --mode rag --limit 6
  python -m eval.chat_eval --provider bedrock --mode both   # results are saved to eval/results/

Scoring is automatic and deliberately coarse:
  * answerable question: correct if every `must_match` pattern appears in the reply; cited if a returned
    source title contains one of `expected_sources` (RAG mode only).
  * unanswerable question (the corpus does not contain the answer): correct if the reply says so. A plain LLM that
    answers from memory fails these. (The rule first also required 'no sources shown'; it was relaxed after a correct
    refusal was marked wrong only because retrieved sources were listed.)
Questions and keys were written from the documents by the author's assistant; spot-check them by hand.
"""
import argparse
import asyncio
import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

HERE = Path(__file__).resolve().parent
CORPUS = HERE.parent / "rag" / "corpus"
REFUSAL = re.compile(r"does not contain|do not contain|doesn.t contain|not (?:cover|include|address|find|in the)|"
                     r"no (?:information|passages|relevant)|couldn.t find|could not find|unable to find|"
                     r"don.t have|do not have|not available|no (?:policy|document)", re.I)
BASELINE_SYSTEM = "You are a prior-authorization assistant for clinic staff. Answer concisely."


def load_questions():
    return json.loads((HERE / "chat_questions.json").read_text())


def doc_text(title_part: str) -> str:
    out = []
    for f in CORPUS.glob("*.md"):
        t = f.read_text(encoding="utf-8")
        if title_part.lower() in t.split("---", 2)[1].lower():
            out.append(t)
    return " ".join(out).replace("\n", " ")


def check_key() -> bool:
    ok = True
    for q in load_questions():
        if not q["answerable"]:
            continue
        text = " ".join(doc_text(s) for s in q["expected_sources"])
        if not text:
            print(f"NO DOC   {q['id']}: {q['expected_sources']}"); ok = False; continue
        for pat in q["must_match"]:
            if not re.search(pat, text, re.I):
                print(f"NOT IN SOURCE {q['id']}: /{pat}/"); ok = False
    print("answer key consistent with the source documents" if ok else "answer key has problems (see above)")
    return ok


def ask_baseline(question: str, provider: str) -> str:
    from agent_runner import claude_model, get_anthropic, get_groq
    if provider in ("bedrock", "claude"):
        r = get_anthropic(provider).messages.create(model=claude_model(provider), max_tokens=4000, system=BASELINE_SYSTEM,
                                                    messages=[{"role": "user", "content": question}])
        return "".join(b.text for b in r.content if b.type == "text")
    r = get_groq().chat.completions.create(model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b"), max_tokens=1500,
                                           messages=[{"role": "system", "content": BASELINE_SYSTEM},
                                                     {"role": "user", "content": question}])
    return r.choices[0].message.content or ""


def norm(text: str) -> str:
    return re.sub(r"[\u2010-\u2015\u2212]", "-", text.replace("\u00a0", " ").replace("\u202f", " "))


def score(q: dict, reply: str, citations: list[dict]) -> dict:
    reply = norm(reply)
    refused = bool(REFUSAL.search(reply))
    if not q["answerable"]:
        return {"correct": refused, "cited": None, "refused": refused}
    correct = all(re.search(p, reply, re.I) for p in q["must_match"])
    cited = any(any(s.lower() in (c["title"] or "").lower() for s in q["expected_sources"]) for c in citations)
    return {"correct": correct, "cited": cited, "refused": refused}


async def run(provider: str, mode: str, limit: int | None, offset: int, only_ids: set | None = None):
    from chat import chat
    qs = load_questions()[offset:]
    qs = qs[:limit] if limit else qs
    if only_ids is not None:
        qs = [q for q in qs if q["id"] in only_ids]
    rows = []
    for q in qs:
        try:
            if mode == "rag":
                r = await chat([{"role": "user", "content": q["question"]}], provider=provider)
                reply, cites, tools = r["reply"], r["citations"], r["tools_used"]
            else:
                reply, cites, tools = await asyncio.get_event_loop().run_in_executor(None, ask_baseline, q["question"], provider), [], []
            err = None
        except Exception as e:
            reply, cites, tools, err = "", [], [], str(e)[:160]
        rows.append({"id": q["id"], "answerable": q["answerable"], "reply": reply[:4000], "citations": [c["title"] for c in cites],
                     "tools_used": tools, "error": err, **(score(q, reply, cites) if not err else {"correct": None, "cited": None, "refused": None})})
    return rows


def summarize(rows):
    ok = [r for r in rows if r["error"] is None]
    ans = [r for r in ok if r["answerable"]]
    una = [r for r in ok if not r["answerable"]]
    pct = lambda xs: round(sum(bool(x) for x in xs) / len(xs), 3) if xs else None
    return {"n": len(rows), "errors": len(rows) - len(ok),
            "answerable_correct": pct([r["correct"] for r in ans]), "n_answerable": len(ans),
            "answerable_cited": pct([r["cited"] for r in ans if r["cited"] is not None]) if any(r["cited"] is not None for r in ans) and any(r["citations"] for r in ans) else None,
            "unanswerable_handled": pct([r["correct"] for r in una]), "n_unanswerable": len(una)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--check-key", action="store_true")
    ap.add_argument("--provider", default=os.environ.get("AI_PROVIDER", "groq"))
    ap.add_argument("--mode", choices=["rag", "baseline", "both"], default="both")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--offset", type=int, default=0)
    ap.add_argument("--resume", action="store_true", help="re-run only the questions that errored in the saved full run")
    a = ap.parse_args()
    if a.check_key:
        raise SystemExit(0 if check_key() else 1)
    (HERE / "results").mkdir(exist_ok=True)
    for mode in (["rag", "baseline"] if a.mode == "both" else [a.mode]):
        full = HERE / "results" / f"chat_{a.provider}_{mode}_full.json"
        if a.resume and full.exists():
            old = json.loads(full.read_text())["rows"]
            redo = {r["id"] for r in old if r["error"]}
            new = {r["id"]: r for r in asyncio.run(run(a.provider, mode, None, 0, redo))}
            rows = [new.get(r["id"], r) for r in old]
            out = full
        else:
            rows = asyncio.run(run(a.provider, mode, a.limit, a.offset))
            out = full if (a.limit is None and a.offset == 0) else HERE / "results" / f"chat_{a.provider}_{mode}_{a.offset}_{len(rows)}.json"
        out.write_text(json.dumps({"summary": summarize(rows), "rows": rows}, indent=1))
        print(mode, json.dumps(summarize(rows)))
