"""Read one patient's FHIR R4 Bundle (an uploaded file) into the same record the Synthea loader builds.

The bundle's resources are turned into Synthea-CSV-shaped rows and passed through synthea_loader.build_from_tables,
so an uploaded record and a loaded one are computed by the same code. Tested against Synthea's own FHIR export.

What FHIR does not carry, and how it is handled:
- MedicationRequest has no stop date (Synthea's CSV has one; its FHIR export does not, and the pharmacy Claim only
  covers the visit). A completed prescription is therefore recorded as given on its start date only, flagged
  "stop_date_unknown", so it adds one day, not an invented duration. An active one stays open-ended. Guessing the end
  as the next prescription of the same drug was tried and overstated short opioid courses by months.
- Encounter.class is coarser than Synthea's CSV class (wellness and outpatient are both AMB).

Uploaded records are kept only in memory for UPLOAD_TTL seconds and are never written to the database.
"""
import secrets
import time
from collections import defaultdict
from datetime import date, datetime, timezone

from synthea_loader import build_from_tables

UPLOAD_TTL = 2 * 3600
MAX_PATIENT_RESOURCES = 200000
CLASS = {"AMB": "ambulatory", "EMER": "emergency", "IMP": "inpatient", "ACUTE": "inpatient", "HH": "home health",
         "VR": "virtual", "OBSENC": "observation"}

_uploads: dict[str, tuple[float, str, dict]] = {}  # patient_id -> (expires, owner, record)


class BundleError(ValueError):
    """The file is not a usable patient bundle; the message is shown to the user."""


def _utc(ts: str | None) -> str:
    """FHIR dateTime (any offset) -> ISO timestamp in UTC, like the Synthea CSV export. Dates pass through."""
    if not ts:
        return ""
    if len(ts) == 10:
        return ts
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _ref(reference: dict | None) -> str:
    r = (reference or {}).get("reference", "")
    return r.rsplit(":", 1)[-1].rsplit("/", 1)[-1]


def _coding(concept: dict | None) -> tuple[str, str]:
    concept = concept or {}
    c = (concept.get("coding") or [{}])[0]
    return c.get("code", ""), c.get("display") or concept.get("text", "")


def tables_from_bundle(bundle: dict) -> dict[str, list[dict]]:
    if not isinstance(bundle, dict) or bundle.get("resourceType") != "Bundle":
        raise BundleError("This is not a FHIR Bundle. Upload a FHIR R4 patient bundle (JSON).")
    resources = [e.get("resource") or {} for e in bundle.get("entry") or []]
    if len(resources) > MAX_PATIENT_RESOURCES:
        raise BundleError("The bundle is too large to read.")
    patients = [r for r in resources if r.get("resourceType") == "Patient"]
    if len(patients) != 1:
        raise BundleError(f"The bundle must contain exactly one Patient; it has {len(patients)}.")
    p = patients[0]
    pid = p.get("id") or "uploaded"
    by_type = defaultdict(list)
    for r in resources:
        by_type[r.get("resourceType")].append(r)

    t = {"patients.csv": [{"Id": pid, "GENDER": {"male": "M", "female": "F"}.get(p.get("gender"), "U"),
                           "BIRTHDATE": p.get("birthDate", ""), "DEATHDATE": _utc(p.get("deceasedDateTime"))[:10]}]}
    if not t["patients.csv"][0]["BIRTHDATE"]:
        raise BundleError("The Patient has no birth date.")
    t["encounters.csv"] = []
    for e in by_type["Encounter"]:
        reason_code, reason = _coding((e.get("reasonCode") or [None])[0])
        t["encounters.csv"].append({
            "Id": e.get("id", ""), "PATIENT": pid, "START": _utc((e.get("period") or {}).get("start")),
            "ENCOUNTERCLASS": CLASS.get((e.get("class") or {}).get("code"), (e.get("class") or {}).get("code", "")),
            "DESCRIPTION": _coding((e.get("type") or [None])[0])[1], "REASONCODE": reason_code, "REASONDESCRIPTION": reason})
    t["conditions.csv"] = []
    for c in by_type["Condition"]:
        code, title = _coding(c.get("code"))
        onset = _utc(c.get("onsetDateTime") or (c.get("onsetPeriod") or {}).get("start") or c.get("recordedDate"))
        if code and onset:
            t["conditions.csv"].append({"PATIENT": pid, "CODE": code, "DESCRIPTION": title, "START": onset[:10]})

    meds = {m.get("id"): _coding(m.get("code"))[1] for m in by_type["Medication"]}
    orders = []
    for m in by_type["MedicationRequest"]:
        name = _coding(m.get("medicationCodeableConcept"))[1] or meds.get(_ref(m.get("medicationReference")), "")
        if name and m.get("authoredOn"):
            orders.append({"PATIENT": pid, "ENCOUNTER": _ref(m.get("encounter")), "DESCRIPTION": name,
                           "START": _utc(m["authoredOn"]), "STOP": "", "_status": m.get("status", "")})
    orders.sort(key=lambda o: o["START"])
    for o in orders:  # see the module docstring: FHIR has no stop date
        if o["_status"] != "active":
            o["STOP"], o["_no_stop"] = o["START"], True
    t["medications.csv"] = orders
    t["procedures.csv"] = []
    for pr in by_type["Procedure"]:
        start = (pr.get("performedPeriod") or {}).get("start") or pr.get("performedDateTime")
        if start:
            t["procedures.csv"].append({"PATIENT": pid, "CODE": _coding(pr.get("code"))[0],
                                        "ENCOUNTER": _ref(pr.get("encounter")), "START": _utc(start)})
    t["imaging_studies.csv"] = []
    for im in by_type["ImagingStudy"]:
        for s in im.get("series") or [{}]:
            t["imaging_studies.csv"].append({"PATIENT": pid, "DATE": _utc(im.get("started") or s.get("started")),
                                             "BODYSITE_DESCRIPTION": (s.get("bodySite") or {}).get("display", ""),
                                             "MODALITY_DESCRIPTION": (s.get("modality") or {}).get("display", "")})
    return t


def _name(bundle: dict) -> str:
    p = next(e["resource"] for e in bundle["entry"] if (e.get("resource") or {}).get("resourceType") == "Patient")
    n = (p.get("name") or [{}])[0]
    strip = lambda s: "".join(ch for ch in s if not ch.isdigit())  # Synthea appends digits to names
    return " ".join(strip(x) for x in [*(n.get("given") or [])[:1], n.get("family", "")] if x).strip() or "Uploaded patient"


def record_from_bundle(bundle: dict, as_of: str | None = None) -> dict:
    tables = tables_from_bundle(bundle)
    record = next(iter(build_from_tables(lambda name: iter(tables.get(name, [])),
                                         as_of or date.today().isoformat()).values()))
    no_stop = {(o["DESCRIPTION"], o["START"][:10]) for o in tables["medications.csv"] if o.get("_no_stop")}
    for m in record["conservative_therapy"]["medications"]:
        if (m["name"], m["start"]) in no_stop:
            m["stop_date_unknown"] = True
    record["source"] = "Uploaded FHIR R4 bundle (synthetic data only)"
    record["name"] = _name(bundle)
    record["birth_date"] = tables["patients.csv"][0]["BIRTHDATE"]
    return record


# --- in-memory store for uploads ---
def save_upload(record: dict, owner: str) -> str:
    now = time.time()
    for k in [k for k, v in _uploads.items() if v[0] < now]:
        del _uploads[k]
    pid = f"upload-{secrets.token_hex(6)}"
    _uploads[pid] = (now + UPLOAD_TTL, owner, {**record, "patient_id": pid})
    return pid


def get_upload(patient_id: str) -> dict | None:
    entry = _uploads.get(patient_id)
    return entry[2] if entry and entry[0] >= time.time() else None


def summary(record: dict) -> dict:
    back = [d for d in record["diagnoses"] if d.get("icd10") and d["code"] != "82423001"]
    ct = record["conservative_therapy"]
    return {
        "name": record["name"], "birth_date": record["birth_date"], "gender": record["gender"], "age": record["age"],
        "back_pain_diagnoses": [{"code": d["code"], "icd10": d["icd10"], "title": d["title"], "onset": d["onset"]} for d in back],
        "suggested_diagnosis_code": back[0]["icd10"] if back else "",
        "back_pain_visits": len(record["back_pain_encounters"]),
        "therapy_sessions": sum(t["sessions"] for t in ct["therapy"]),
        "medications": len(ct["medications"]),
        "prior_imaging": len(record["prior_imaging"]),
        "diagnoses": len(record["diagnoses"]),
    }
