"""Load the open MIMIC-IV Clinical Database Demo (100 de-identified patients) into SQLite.

Run from backend/:  python -m mimic_loader
Source: https://physionet.org/content/mimic-iv-demo/2.2/  (Open Database License v1.0; hospital admissions
only, no free-text notes). Dates are shifted by the publisher, so ages come from `anchor_age`.
"""
import csv
import gzip
import re
import subprocess
import zipfile
from collections import defaultdict
from pathlib import Path

import db

DATA = Path(__file__).parent / "data"
ROOT = DATA / "mimic-iv-clinical-database-demo-2.2" / "hosp"
URL = "https://physionet.org/static/published-projects/mimic-iv-demo/mimic-iv-clinical-database-demo-2.2.zip"
# drug names that count as conservative-therapy medications (analgesics, NSAIDs, muscle relaxants)
CONSERVATIVE = re.compile(r"ibuprofen|naproxen|ketorolac|diclofenac|meloxicam|celecoxib|cyclobenzaprine|"
                          r"methocarbamol|tizanidine|baclofen|acetaminophen|tramadol|gabapentin|lidocaine 5% patch", re.I)


def _rows(name):
    with gzip.open(ROOT / name, "rt", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def download():
    DATA.mkdir(exist_ok=True)
    zip_path = DATA / "mimic_demo.zip"
    subprocess.run(["curl", "-sfL", "-m", "600", "-o", str(zip_path), URL], check=True)
    zipfile.ZipFile(zip_path).extractall(DATA)


def load() -> int:
    if not ROOT.exists():
        download()
    dx_titles = {(r["icd_code"], r["icd_version"]): r["long_title"] for r in _rows("d_icd_diagnoses.csv.gz")}
    px_titles = {(r["icd_code"], r["icd_version"]): r["long_title"] for r in _rows("d_icd_procedures.csv.gz")}
    diagnoses, procedures, drugs, admissions = defaultdict(dict), defaultdict(dict), defaultdict(set), defaultdict(int)
    for r in _rows("diagnoses_icd.csv.gz"):
        diagnoses[r["subject_id"]].setdefault(r["icd_code"], {
            "code": r["icd_code"], "icd_version": int(r["icd_version"]),
            "title": dx_titles.get((r["icd_code"], r["icd_version"]), "")})
    for r in _rows("procedures_icd.csv.gz"):
        procedures[r["subject_id"]].setdefault(r["icd_code"], {
            "code": r["icd_code"], "title": px_titles.get((r["icd_code"], r["icd_version"]), "")})
    for r in _rows("prescriptions.csv.gz"):
        drugs[r["subject_id"]].add(r["drug"].strip())
    for r in _rows("admissions.csv.gz"):
        admissions[r["subject_id"]] += 1
    n = 0
    for p in _rows("patients.csv.gz"):
        sid = p["subject_id"]
        meds = sorted(drugs[sid])
        db.save_patient_record(sid, {
            "subject_id": sid, "gender": p["gender"], "age": int(p["anchor_age"]), "admissions": admissions[sid],
            "diagnoses": list(diagnoses[sid].values()), "procedures": list(procedures[sid].values()),
            "medications": meds, "conservative_therapy_medications": [m for m in meds if CONSERVATIVE.search(m)],
            "source": "MIMIC-IV Clinical Database Demo 2.2 (ODbL)"})
        n += 1
    return n


if __name__ == "__main__":
    print(f"Loaded {load()} patient records")
