"""Load Synthea synthetic patients (CSV export) into SQLite, with the outpatient back-pain history MIMIC lacks.

Generate the data once (Java 17, run from backend/data/synthea/):
  java -jar synthea-with-dependencies.jar -s 42 -cs 42 -p 500 --exporter.csv.export=true \
       --exporter.fhir.export=false --exporter.hospital.fhir.export=false \
       --exporter.practitioner.fhir.export=false --exporter.baseDirectory=./output Massachusetts
Then, from backend/:  python -m synthea_loader [csv_dir]

All patients are synthetic (https://synthetichealth.github.io/synthea/, Apache 2.0). Diagnosis codes are SNOMED CT;
a few back-pain concepts also get an ICD-10-CM code (ICD10 below). In Synthea, back pain comes from the chronic-pain
module: low back pain is "Chronic low back pain", encounters for it carry the reason "Chronic pain", and physical
therapy is recorded as "Movement therapy" procedures at those encounters. Synthea produces no sciatica,
radiculopathy or lumbar-spine imaging, so prior_imaging is usually empty.
"""
import csv
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

import db
from mimic_loader import CONSERVATIVE

CSV_DIR = Path(__file__).parent / "data" / "synthea" / "output" / "csv"
SOURCE = "Synthea synthetic patients (SNOMED CT codes; not real people)"
BACK_PAIN = {"278860009", "279039007", "23056005", "202794004", "128196005"}  # chronic LBP, LBP, sciatica, disc disorders
PAIN_REASONS = BACK_PAIN | {"82423001"}  # encounters for back pain are coded with the reason "Chronic pain"
# small, explicit SNOMED -> ICD-10-CM map for the back-pain concepts only
ICD10 = {"278860009": "M54.50", "279039007": "M54.50", "23056005": "M54.30", "82423001": "G89.29"}
THERAPY_PROCEDURES = {"229064008": "physical therapy", "91251008": "physical therapy", "228557008": "cognitive behavioral therapy"}
SPINE_IMAGING = re.compile(r"lumb|spine|spinal|vertebr|sacr|back", re.I)
PAIN_DRUG = re.compile(CONSERVATIVE.pattern + r"|naproxen|oxycodone|hydrocodone|fentanyl|codeine|morphine", re.I)
OPIOID = re.compile(r"oxycodone|hydrocodone|fentanyl|codeine|tramadol|morphine|buprenorphine", re.I)


def _rows(csv_dir: Path, name: str):
    path = csv_dir / name
    if not path.exists():
        return
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)


def _day(ts: str) -> str:
    return ts[:10]


def _weeks(intervals: list[tuple[str, str]]) -> float:
    """Total weeks covered by the union of [start, end] date intervals (one-day items count as one day)."""
    spans = sorted((date.fromisoformat(s), date.fromisoformat(e)) for s, e in intervals)
    days, cur_s, cur_e = 0, None, None
    for s, e in spans:
        if cur_e is None or s > cur_e:
            if cur_e is not None:
                days += (cur_e - cur_s).days + 1
            cur_s, cur_e = s, e
        else:
            cur_e = max(cur_e, e)
    if cur_e is not None:
        days += (cur_e - cur_s).days + 1
    return round(days / 7, 1)


def build_records(csv_dir: Path = CSV_DIR, as_of: str | None = None) -> dict[str, dict]:
    return build_from_tables(lambda name: _rows(csv_dir, name), as_of)


def build_from_tables(rows, as_of: str | None = None) -> dict[str, dict]:
    """Records from Synthea-CSV-shaped rows. rows(name) yields the rows of one table ("encounters.csv", ...);
    fhir_import supplies the same tables built from a FHIR bundle, so both paths share this logic."""
    encounters = {r["Id"]: r for r in rows("encounters.csv")}
    as_of = as_of or max((_day(e["START"]) for e in encounters.values()), default=date.today().isoformat())
    diagnoses, first_bp = defaultdict(dict), {}
    for r in rows("conditions.csv"):
        pid, code = r["PATIENT"], r["CODE"]
        dx = diagnoses[pid].setdefault(code, {"code": code, "system": "SNOMED CT", "title": r["DESCRIPTION"],
                                              "onset": r["START"]})
        dx["onset"] = min(dx["onset"], r["START"])
        if code in ICD10:
            dx["icd10"] = ICD10[code]
        if code in BACK_PAIN:
            first_bp[pid] = min(first_bp.get(pid, r["START"]), r["START"])

    pain_enc = {eid for eid, e in encounters.items() if e["REASONCODE"] in PAIN_REASONS}
    # Synthea often prescribes chronic-pain drugs at wellness visits with no reason code, so a pain drug counts if it
    # was given at a back-pain encounter, or started after the first back-pain diagnosis at a visit with no other reason.
    meds = defaultdict(list)
    for r in rows("medications.csv"):
        pid, enc = r["PATIENT"], encounters.get(r["ENCOUNTER"], {})
        if pid not in first_bp or not PAIN_DRUG.search(r["DESCRIPTION"]):
            continue
        if r["ENCOUNTER"] in pain_enc or (not enc.get("REASONCODE") and _day(r["START"]) >= first_bp[pid]):
            meds[r["PATIENT"]].append({"name": r["DESCRIPTION"], "start": _day(r["START"]),
                                       "end": _day(r["STOP"]) if r["STOP"] else None,
                                       "opioid": bool(OPIOID.search(r["DESCRIPTION"]))})
    sessions = defaultdict(list)
    for r in rows("procedures.csv"):
        if r["CODE"] in THERAPY_PROCEDURES and r["ENCOUNTER"] in pain_enc:
            sessions[r["PATIENT"]].append((THERAPY_PROCEDURES[r["CODE"]], _day(r["START"])))
    imaging = defaultdict(list)
    for r in rows("imaging_studies.csv"):
        if SPINE_IMAGING.search(r["BODYSITE_DESCRIPTION"]):
            imaging[r["PATIENT"]].append({"date": _day(r["DATE"]), "body_site": r["BODYSITE_DESCRIPTION"],
                                          "modality": r["MODALITY_DESCRIPTION"]})
    visits = defaultdict(list)
    for eid in pain_enc:
        e = encounters[eid]
        visits[e["PATIENT"]].append({"date": _day(e["START"]), "class": e["ENCOUNTERCLASS"],
                                     "type": e["DESCRIPTION"], "reason": e["REASONDESCRIPTION"]})

    records = {}
    for p in rows("patients.csv"):
        pid = p["Id"]
        end = p["DEATHDATE"] or as_of
        born = date.fromisoformat(p["BIRTHDATE"])
        age = (date.fromisoformat(end) - born).days // 365
        med_list = sorted(meds[pid], key=lambda m: m["start"])
        therapy = []
        for kind in sorted({k for k, _ in sessions[pid]}):
            days = sorted(d for k, d in sessions[pid] if k == kind)
            therapy.append({"type": kind, "sessions": len(days), "start": days[0], "end": days[-1], "session_dates": days})
        intervals = [(m["start"], m["end"] or end) for m in med_list] + [(t["start"], t["end"]) for t in therapy]
        starts = [s for s, _ in intervals]
        records[pid] = {
            "patient_id": pid, "gender": p["GENDER"], "age": age, "deceased": bool(p["DEATHDATE"]),
            "diagnoses": sorted(diagnoses[pid].values(), key=lambda d: (d["code"] not in BACK_PAIN, d["onset"])),
            "conservative_therapy_medications": sorted({m["name"] for m in med_list}),
            "source": SOURCE, "as_of": end,
            "first_back_pain_diagnosis_date": first_bp.get(pid),
            "back_pain_encounters": sorted(visits[pid], key=lambda v: v["date"]),
            "conservative_therapy": {
                "medications": med_list, "therapy": therapy,
                "start": min(starts) if starts else None,
                "end": max(e for _, e in intervals) if intervals else None,
                "total_weeks": _weeks(intervals),
            },
            "prior_imaging": sorted(imaging[pid], key=lambda i: i["date"]),
        }
    return records


def load(csv_dir: Path = CSV_DIR) -> int:
    if not (csv_dir / "patients.csv").exists():
        sys.exit(f"No Synthea CSV export in {csv_dir}; see the command at the top of synthea_loader.py")
    records = build_records(csv_dir)
    db.replace_synthea_records(records)
    return len(records)


if __name__ == "__main__":
    n = load(Path(sys.argv[1]) if len(sys.argv) > 1 else CSV_DIR)
    print(f"Loaded {n} Synthea patient records")
