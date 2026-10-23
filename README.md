# MedBridge — AI Prior Authorization Agent

> Prior authorization drafted in minutes, with cited policy evidence. A person approves before anything is sent.

> 🏆 **1st Place Winner** — AI Agents Hackathon, hosted by OSS4AI in collaboration with Beta Fund and Gravitational Ventures | Solo build. This repository extends that prototype as a course project (INFO 7375, Northeastern).

MedBridge is an LLM agent for clinic staff. It scans a payer's policy, analyzes the patient's records, completes the authorization form, **pauses for human approval**, then submits and tracks the request. If the payer denies it, the agent drafts an appeal that cites the retrieved policy text. A separate chatbot answers coverage questions from the same policy documents, with sources.

**Status: research prototype.** Payer submission (EDI 278) and payer decisions are **simulated**; nothing is sent to a real payer. Patient records are read from the open MIMIC-IV demo (100 real, de-identified patients; hospital-admission data only). It must not be used with real patient data.

---

## Why this problem

- In the AMA's 2024 survey of 1,000 physicians, 94% said prior authorization delays necessary care, 24% reported a serious adverse event for a patient, and practices reported 43 requests and about 12 staff hours per physician per week ([AMA](https://www.ama-assn.org/press-center/press-releases/ama-survey-indicates-prior-authorization-wreaks-havoc-patient-care); the AMA opposes prior authorization).
- In 2024 Medicare Advantage insurers fully or partially denied 4.1 million of 52.8 million requests; 80.7% of appealed denials were overturned, but only 11.5% of denials were appealed ([KFF](https://www.kff.org/f63a430)).
- Wait times are contested: in an AMA survey (2017 data), about two-thirds of physicians waited at least one business day for a decision and roughly 30% waited three days or longer ([AMA](https://ama-assn.org/survey-patient-clinical-outcomes-shortchanged-prior-authorization)); insurer-reported medians are about one day ([KFF](https://www.kff.org/patient-consumer-protections/prior-authorization-metrics-provide-new-insights-into-insurer-practices-but-gaps-remain/)).
- CAQH Index 2019: a manual prior authorization cost providers $10.92 versus $1.88 electronically ([summary](https://blog.quadax.com/key-takeaways-from-the-2019-caqh-index)).

---

## Hackathon demo (earlier version)

[Watch the demo video](https://drive.google.com/file/d/1cygGQlXmpLLv3FvAu5zmC6dwqmULOCZ2/view?usp=drive_link) · [Slide deck (PDF)](presentation/MedBridge_Presentation_Deck.pdf). Both show the original prototype; the screenshots in `frontend/src/assets` are from that version too, and it did not yet have the approval step, chatbot or real policy corpus.

---

## What it does

| Feature | Details |
|---|---|
| **Agentic tool loop** | The LLM chooses the next tool, reads the result and continues. Six tools: `scan_insurance_policy`, `analyze_medical_records`, `fill_authorization_form`, `submit_authorization`, `track_authorization_status`, `draft_appeal`. |
| **RAG over real policies** | ChromaDB index of public documents (below). Retrieval is filtered by payer. Every passage keeps its source URL. |
| **Human approval gate** | The agent pauses before `submit_authorization`. A reviewer approves or rejects in the UI; rejection stops the request. |
| **Policy chatbot** | `POST /api/chat`. Answers only from retrieved passages, cites sources, and says so when the collection doesn't cover a payer. |
| **Open patient data** | `analyze_medical_records` looks the patient up in the MIMIC-IV demo (SQLite) and reports diagnoses, procedures and analgesic/NSAID medications on record, with its limits. |
| **History and audit trail** | Requests, steps and who-did-what are stored in SQLite (`backend/medbridge.db`). |
| **Denial → appeal** | On a simulated denial the agent drafts an appeal citing the retrieved policy text. Appeals still need physician review. |

### Policy documents (`backend/rag/corpus`)

Downloaded from the publishers by `python -m rag.build_corpus` (source URL and retrieval date saved in each file). The documents themselves are not committed to this repository; run the command once before building the index:

- Aetna Clinical Policy Bulletins 0236 (MRI/CT of the spine), 0171 (MRI of the extremities), 0093 (open MRI units), 0325 (physical therapy), 0157 (obesity surgery)
- CMS National Coverage Determination 220.2 (MRI)
- Blue Cross Blue Shield of South Carolina CAM 709 (MRI lumbar spine)
- UnitedHealthcare Commercial MP.13.20 (MRI/CT site of service) and UnitedHealthcare Medicare Advantage MMP076 (radiologic diagnostic procedures). These cover where imaging is done and general radiology coverage rules, **not** lumbar-MRI clinical criteria.

- Cigna Medical Coverage Policy 0550 (site of care for MRI/CT). Cigna's clinical imaging criteria are delegated to eviCore and are **not** in the corpus.

171 chunks from 10 documents. Humana and Medicaid documents are **not** included yet: I found no fetchable official policy text for them.

### Retrieval evaluation

`python -m eval.retrieval_eval` — 29 hand-written questions, each labeled with the document that answers it.

| | Recall@1 | Recall@3 | MRR |
|---|---|---|---|
| With payer filter | 0.86 | 1.00 | 0.92 |
| Without payer filter | 0.55 | 0.86 | 0.70 |

**Real denial cases** (`python -m eval.imr_eval`, open data from the [California Department of Managed Health Care](https://data.chhs.ca.gov), run `--download` first): of 64 independent medical reviews where a lumbar-spine MRI was requested, 33 (52%) overturned the plan's denial. Using only the case description as the query, retrieval returned a spine-MRI policy at rank 1 for 94% of cases and in the top 3 for 63/64 (chance is about 67% at rank 5). Relevance is topic-level, not criterion-level.

The questions were written by the author after reading the documents and the corpus is small, so treat this as a sanity check, not a benchmark. `python -m eval.agent_eval --provider groq --runs 10` checks that the agent produces the expected tool sequence (auto-approving the review step). On the current version (approval gate auto-approved, real MIMIC demo patient, real policy corpus) with `openai/gpt-oss-120b` on Groq, 5 of 5 runs in each scenario (standard approval; denial with appeal) produced the expected tool sequence with no errors, and the appeal cited Aetna CPB 0236. Five runs is a small sample, and an earlier 3-run pilot on a previous version once skipped the submission step. Bedrock results are pending.

---

## Architecture

```
React (Vite) ── chat · request form · review screen · history
      │ HTTP (+1.5 s polling)
FastAPI ── /api/chat · /api/workflow/* · SQLite (requests, steps, audit)
      │
Agent runner ── LLM → tool call → observe → repeat
      │            (pauses at approval-required tools)
      ├── Healthcare vertical: 6 tools (patient records from the MIMIC-IV demo; payer responses simulated)
      └── RAG: ChromaDB + all-MiniLM-L6-v2 embeddings → cited policy passages
LLM provider: Groq (default openai/gpt-oss-120b), Claude, or Gemini
```

The agent runner and UI are generic; each vertical (healthcare, legal, finance) is one module of tools, prompts and form fields. Only `healthcare` is registered.

---

## Setup

Prerequisites: Python 3.11+, Node 18+, a Groq API key (free tier is rate-limited, about 200k tokens/day).

```bash
# 1. Environment — .env in the project root
GROQ_API_KEY=your_groq_key_here
# GROQ_MODEL=openai/gpt-oss-120b   # optional override

# 2. Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
pip install pymupdf                  # only needed to rebuild the corpus
python -m rag.build_corpus           # required: downloads the public policy documents (they are not committed)
python -m rag.store                  # build the vector index
python -m mimic_loader               # download + load the open MIMIC-IV demo patients (demo form uses patient 10021312)
uvicorn main:app --port 8000

# 3. Frontend
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

The Docker files are from the hackathon version and have not been updated.

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Policy chatbot. Body: `{"messages":[{"role":"user","content":"..."}]}`. Returns reply, citations, tools used. |
| `POST` | `/api/workflow/submit` | Start a prior-auth request. |
| `GET` | `/api/workflow/{id}/status` | Status, steps and audit trail. Status `awaiting_approval` means the agent is paused. |
| `POST` | `/api/workflow/{id}/approve` | Body: `{"approved": true, "reviewer": "...", "note": "..."}`. |
| `GET` | `/api/workflow/history/all` | Saved requests. |
| `POST` | `/api/demo/reset` | Clear saved requests. |
| `GET` | `/health` | Health check. |

---

## Limitations

- Payer submission and payer decisions are simulated. Patient data is only the 100-patient open MIMIC-IV demo: hospital admissions, no outpatient notes, so conservative-therapy duration cannot be confirmed from a record. The structured coverage fields returned by the policy-scan tool are still a hard-coded table next to the retrieved passages.
- Small policy corpus (10 documents; Aetna, Medicare, Blue Cross Blue Shield of South Carolina, UnitedHealthcare, Cigna site-of-care only; no Humana or Medicaid, and no lumbar-MRI criteria for UnitedHealthcare or Cigna).
- No user accounts or roles; the reviewer name is free text.
- Not HIPAA-compliant. Do not enter real patient data, and do not send it to a free-tier LLM API.
- Generated appeals and answers are informational and need clinician review.

## Roadmap

Full MIMIC-IV (needs credentialed access) or Synthea for more patients, more payer policy documents, user roles, a FHIR-shaped submission mock, and a chatbot evaluation set.

## Built With

[FastAPI](https://fastapi.tiangolo.com/) · [ChromaDB](https://www.trychroma.com/) · [sentence-transformers](https://www.sbert.net/) · [Groq](https://groq.com/) · [React](https://react.dev/) + [Vite](https://vitejs.dev/)

## License

All Rights Reserved. See [LICENSE](LICENSE).
