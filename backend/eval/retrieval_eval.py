"""Retrieval evaluation over the real policy corpus: Recall@k and MRR, with vs. without the payer filter.

Run from backend/:  python -m eval.retrieval_eval
Ground truth: each hand-written query names a substring of the document title that answers it.
Queries were written from reading the documents, then phrased the way staff would ask;
the last group uses the exact query template the agent issues.
"""
import json
import sys

from rag import store

KS = (1, 3, 5)

QUERIES = [  # (payer, query, relevant title substring)
    # Aetna spine
    ("Aetna", "when is spine MRI medically necessary after failed conservative therapy", "CPB 0236"),
    ("Aetna", "exceptions to the conservative therapy waiting period cauda equina", "CPB 0236"),
    ("Aetna", "how many weeks of conservative therapy before MRI for radiculopathy", "CPB 0236"),
    ("Aetna", "what counts as conservative therapy NSAIDs muscle relaxants", "CPB 0236"),
    ("Aetna", "is dynamic kinetic MRI of the cervical spine covered", "CPB 0236"),
    # Aetna extremities / open MRI
    ("Aetna", "knee MRI persistent pain swelling instability conservative treatment weeks", "CPB 0171"),
    ("Aetna", "MRI for torn meniscus or loose body in the knee", "CPB 0171"),
    ("Aetna", "does Aetna cover open or low field strength MRI scanners", "CPB 0093"),
    # Aetna PT / obesity surgery
    ("Aetna", "physical therapy medically necessary restore function lost to injury", "CPB 0325"),
    ("Aetna", "will the condition improve significantly within one month of starting therapy", "CPB 0325"),
    ("Aetna", "bariatric surgery BMI requirements and comorbidities", "CPB 0157"),
    ("Aetna", "documented weight loss attempts before obesity surgery", "CPB 0157"),
    # Medicare
    ("Medicare", "Medicare coverage of MRI for patients with pacemakers", "NCD 220.2"),
    ("Medicare", "national coverage determination for magnetic resonance imaging", "NCD 220.2"),
    ("Medicare", "MRI contraindicated implanted cardiac devices coverage conditions", "NCD 220.2"),
    # Blue Cross Blue Shield (South Carolina)
    ("Blue Cross Blue Shield", "lumbar spine MRI neurological deficit muscle weakness criteria", "CAM 709"),
    ("Blue Cross Blue Shield", "indications for lumbar MRI cauda equina suspected infection", "CAM 709"),
    ("Blue Cross Blue Shield", "when is repeat lumbar MRI after spine surgery necessary", "CAM 709"),
    # Blue Cross Blue Shield of Louisiana (Medicare Advantage) and HealthHelp (radiology benefits manager)
    ("Blue Cross Blue Shield", "red flag conditions that justify lumbar MRI saddle anesthesia fever history of cancer", "MNG-018"),
    ("Blue Cross Blue Shield", "lumbar MRI after one month of symptoms and failed home exercise physical therapy anti-inflammatory", "MNG-018"),
    ("HealthHelp", "lumbar MRI active conservative management at least 6 weeks within last 6 months symptoms persist", "HealthHelp"),
    ("HealthHelp", "lumbar radiculopathy demonstrated on nerve conduction study or EMG", "HealthHelp"),
    ("HealthHelp", "cauda equina syndrome suspected lumbar MRI bowel bladder dysfunction", "HealthHelp"),
    # UnitedHealthcare (site-of-service and Medicare Advantage radiology rules; no lumbar criteria in these)
    ("United Healthcare", "when is an MRI in the hospital outpatient department medically necessary instead of a freestanding facility", "MP.13.20"),
    ("United Healthcare", "MRI requires sedation or general anesthesia not available at freestanding imaging center", "MP.13.20"),
    ("United Healthcare", "are diagnostic imaging services for asymptomatic persons covered under Medicare Advantage", "MMP076"),
    # Cigna (site-of-care policy only; its clinical imaging criteria are delegated to eviCore and not in the corpus)
    ("Cigna", "when is an MRI in a hospital-based imaging department medically necessary for a Cigna member", "Cigna Medical Coverage Policy 0550"),
    ("Cigna", "Cigna site of care policy does not apply when there is no free-standing facility in the geographic area", "Cigna Medical Coverage Policy 0550"),
    # The agent's own query template (healthcare.retrieve_policy_evidence)
    ("Aetna", "Aetna prior authorization criteria for MRI M72.5", "CPB 0236"),
    ("Aetna", "Aetna prior authorization criteria for Physical Therapy", "CPB 0325"),
    ("Medicare", "Medicare prior authorization criteria for MRI", "NCD 220.2"),
    ("Blue Cross Blue Shield", "Blue Cross Blue Shield prior authorization criteria for MRI", "CAM 709"),
    ("United Healthcare", "United Healthcare prior authorization criteria for MRI", "UnitedHealthcare"),
    ("Cigna", "Cigna prior authorization criteria for MRI", "Cigna Medical Coverage Policy 0550"),
]


def evaluate(queries, use_payer_filter: bool, k: int = max(KS)) -> dict:
    ranks, misses = [], []
    for payer, q, relevant in queries:
        hits = store.search(q, k=k, payer=payer if use_payer_filter else None)
        rank = next((i + 1 for i, h in enumerate(hits) if relevant in (h["title"] or "")), None)
        ranks.append(rank)
        if rank is None or rank > 1:
            misses.append({"query": q, "expected": relevant, "rank": rank, "top": hits[0]["title"] if hits else None})
    n = len(ranks)
    out = {f"recall@{c}": round(sum(r is not None and r <= c for r in ranks) / n, 3) for c in KS}
    out["mrr"] = round(sum(1 / r for r in ranks if r) / n, 3)
    out["n"] = n
    return out, misses


if __name__ == "__main__":
    print(f"Indexed {store.ingest()} chunks", file=sys.stderr)
    report = {}
    for flag in (True, False):
        res, misses = evaluate(QUERIES, flag)
        report[f"payer_filter={flag}"] = {**res, "not_rank_1": misses}
    print(json.dumps(report, indent=2))
