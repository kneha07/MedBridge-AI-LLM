# MedBridge — AI Prior Authorization Agent

> Prior authorization drafted in minutes, with cited policy evidence. A person approves before anything is sent.

> 🏆 **1st Place Winner** — AI Agents Hackathon, hosted by OSS4AI in collaboration with Beta Fund and Gravitational Ventures | Solo build. This repository extends that prototype as a course project (INFO 7375, Northeastern).

MedBridge is an LLM agent for clinic staff. It scans a payer's policy, analyzes the patient's records, completes the authorization form, **pauses for human approval**, then submits and tracks the request. If the payer denies it, the agent drafts an appeal that cites the retrieved policy text. A separate chatbot answers coverage questions from the same policy documents, with sources.

**Model options.** The agent and the chatbot run on **Groq**, **Claude** (Anthropic API) or **Claude on Amazon Bedrock**, chosen with one setting (`AI_PROVIDER`). The evaluations so far were run on Groq; the Claude and Bedrock paths are implemented. The Bedrock path (`us.anthropic.claude-sonnet-4-6`) has only been smoke-tested (one agent run per scenario, three chat questions, no errors), so full results are still to be added.

**Status: research prototype.** Payer submission (EDI 278) and payer decisions are **simulated**; nothing is sent to a real payer. Patient records are read from the open MIMIC-IV demo (100 real, de-identified patients; hospital-admission data only). It must not be used with real patient data.

---

## Why this problem

- In an AMA survey of 1,000 physicians (fielded December 2023, published June 2024), 94% said prior authorization delays necessary care, 24% reported a serious adverse event for a patient, and physicians reported completing an average of 43 requests a week, equal to about 12 hours of physician and staff time ([AMA](https://www.ama-assn.org/press-center/press-releases/ama-survey-indicates-prior-authorization-wreaks-havoc-patient-care); the AMA opposes prior authorization).
- In 2024 Medicare Advantage insurers fully or partially denied 4.1 million of 52.8 million requests; 80.7% of appealed denials were overturned, but only 11.5% of denials were appealed ([KFF](https://www.kff.org/medicare/medicare-advantage-insurers-made-nearly-53-million-prior-authorization-determinations-in-2024/)).
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
| **FHIR-shaped submission (simulated)** | The submit step builds a `Bundle` with a `Claim` (use `preauthorization`), `Patient`, `Practitioner`, `Organization` and `Coverage`, and the tracking step returns a `ClaimResponse` (pended or denied). Both are shown in the step details. They follow the general shape of the Da Vinci Prior Authorization Support exchange but are **not validated against its profiles**, use placeholder procedure codes (e.g. CPT 72148 for lumbar MRI), and are never sent anywhere. Code: `backend/fhir_mock.py`, tests: `backend/tests/test_fhir_mock.py`. |
| **RAG over real policies** | ChromaDB index of public documents (below). Retrieval is filtered by payer. Every passage keeps its source URL. |
| **Human approval gate** | The agent pauses before `submit_authorization`. A reviewer approves or rejects in the UI; rejection stops the request. |
| **Accounts, roles and sign-in** | Sign-in is on by default. Anyone can **create an account** (full name, work email, optional organization, and a password of at least 8 characters entered twice; the password is stored only as a salted scrypt hash, and people sign in with their email); new accounts are always **staff**. **Staff** prepare requests and use the chat; **reviewers** also approve or reject and can promote or demote signed-up users on the **Team** tab. Two public demo accounts are shown on the sign-in screen: `alice` (reviewer, PIN 2468) and `bob` (staff, PIN 1357). The approver's name comes from the signed token (not from the request body), nobody can approve a request they submitted, and five wrong tries lock a name for five minutes. Set `MEDBRIDGE_AUTH=off` to turn sign-in off or `MEDBRIDGE_USERS` (see `.env.example`) to replace the demo accounts. Tests: `backend/tests/test_auth.py`. |
| **Policy chatbot** | `POST /api/chat`. Answers only from retrieved passages, cites sources, and says so when the collection doesn't cover a payer. |
| **Open patient data** | `analyze_medical_records` looks the patient up in the MIMIC-IV demo (SQLite) and reports diagnoses, procedures and analgesic/NSAID medications on record, with its limits. |
| **History and audit trail** | Requests, steps and who-did-what are stored in SQLite (`backend/medbridge.db`). |
| **Denial → appeal** | On a simulated denial the agent drafts an appeal citing the retrieved policy text. Appeals still need physician review. |

### Policy documents (`backend/rag/corpus`)

Downloaded from the publishers by `python -m rag.build_corpus` (source URL and retrieval date saved in each file). The documents themselves are not committed to this repository; run the command once before building the index:

- Aetna Clinical Policy Bulletins 0236 (MRI/CT of the spine), 0171 (MRI of the extremities), 0093 (open MRI units), 0325 (physical therapy), 0157 (obesity surgery)
- CMS National Coverage Determination 220.2 (MRI)
- Blue Cross Blue Shield of South Carolina CAM 709 (MRI lumbar spine) and Blue Cross Blue Shield of Louisiana MNG-018 (MRI lumbar spine, Medicare Advantage)
- UnitedHealthcare Commercial MP.13.20 (MRI/CT site of service) and UnitedHealthcare Medicare Advantage MMP076 (radiologic diagnostic procedures). These cover where imaging is done and general radiology coverage rules, **not** lumbar-MRI clinical criteria.

- Cigna Medical Coverage Policy 0550 (site of care for MRI/CT). Cigna's clinical imaging criteria are delegated to eviCore and are **not** in the corpus.
- HealthHelp (WNS) MRI Lumbar Spine Guideline. HealthHelp is a radiology benefits manager that writes guidelines for health plans, **not** a payer: it is indexed under its own name, so a question about Humana, UnitedHealthcare or Cigna is never answered from it.

191 chunks from 12 documents. Humana and Medicaid documents are **not** included yet: I found no fetchable official policy text for them (searched again; Humana's own clinical criteria and current state Medicaid manuals were not retrievable).

### Retrieval evaluation

`python -m eval.retrieval_eval` — 34 hand-written questions, each labeled with the document that answers it.

| | Recall@1 | Recall@3 | MRR |
|---|---|---|---|
| With payer filter | 0.82 | 0.97 | 0.89 |
| Without payer filter | 0.53 | 0.79 | 0.66 |

On the generic "Blue Cross Blue Shield … MRI" queries the Louisiana policy can now rank first although the query was labeled with the South Carolina one; both are valid answers, but the scorer counts only the labeled document, so those rows lower Recall@1.

**Real denial cases** (`python -m eval.imr_eval`, open data from the [California Department of Managed Health Care](https://data.chhs.ca.gov), run `--download` first): of 64 independent medical reviews where a lumbar-spine MRI was requested, 33 (52%) overturned the plan's denial. Using only the case description as the query, retrieval returned a spine-MRI policy at rank 1 for 94% of cases and in the top 3 for 63/64 (chance is about 67% at rank 5). Relevance is topic-level, not criterion-level.

The questions were written by the author after reading the documents and the corpus is small, so treat this as a sanity check, not a benchmark. `python -m eval.agent_eval --provider groq --runs 10` checks that the agent produces the expected tool sequence (auto-approving the review step). On the current version (approval gate auto-approved, real MIMIC demo patient, real policy corpus) with `openai/gpt-oss-120b` on Groq, 5 of 5 runs in each scenario (standard approval; denial with appeal) produced the expected tool sequence with no errors, and the appeal cited Aetna CPB 0236. Five runs is a small sample, and an earlier 3-run pilot on a previous version once skipped the submission step. On Claude Sonnet 4.6 through Amazon Bedrock, 5 of 5 runs in each scenario also produced the expected tool sequence with no errors, and the appeal cited Aetna CPB 0236 (`eval/results/agent_bedrock_5.json`).

**Chatbot evaluation** (`python -m eval.chat_eval --provider bedrock --mode both` and `--mode static`, 36 questions: 30 answerable, 6 not answered by the corpus; coarse automatic scoring, saved in `eval/results/`):

| Claude Sonnet 4.6 (Bedrock) | Answerable correct | Cited a right source | Unanswerable handled |
|---|---|---|---|
| With retrieval (the chatbot) | 27/30 (0.90) | 30/30 | 5/6 |
| Plain LLM, no retrieval | 22/30 (0.73) | n/a | 3/6 |
| Hard-coded policy table in the prompt (`--mode static`) | 11/30 (0.37) | n/a | 6/6 |

The hard-coded table (the `policy_data.py` dictionary the project started with) is the "agent without RAG" ablation: it cannot answer detail questions such as exact week counts, BMI thresholds or the Medicare pacemaker conditions. Its 6/6 on unanswerable questions mostly reflects that it has little content to answer from, not better judgement.

Retrieval misses (3 answerable, 1 unanswerable): `uhc-sign` (the model said the passages list no per-service documentation requirements); `bcbs-4wk` and `bcbsla-redflag`; and `na-cpt`, a CPT-coding request the model declined as out of scope rather than as "not in the documents". The first 30 questions scored 23/24 with retrieval before two documents were added. After adding the Blue Cross Blue Shield of Louisiana and HealthHelp lumbar policies, `bcbs-4wk` started to fail because a second, similar Blue Cross lumbar policy competes for the top-k results and the South Carolina passage with the duration rule was not returned, and `bcbsla-redflag` listed the red flags correctly up to the point where the retrieved chunk was cut off, before "saddle anesthesia". Adding similar documents can therefore hurt retrieval. The scorer ignores markdown bold so that "does **not** include" counts as a refusal. Groq results in the same folder are partial (rate-limit errors on the retrieval run) and use the earlier 30 questions.

**Passages per search (`CHAT_TOP_K`)**, Claude Sonnet 4.6 on Bedrock, retrieval mode. The default is 4.

| Question set | Passages | Runs | Answerable correct | Cited a right source |
|---|---|---|---|---|
| First 36 (answerable: 30) | 4 | 2 | 27/30, 27/30 | 30/30 |
| First 36 | 6 | 2 | 29/30, 29/30 | 30/30 |
| First 36 | 8 | 1 | 28/30 | 27/30 |
| **Held-out 20** (answerable: 16) | 4 | 2 | 14/16, 15/16 | 16/16, 16/16 |
| **Held-out 20** | 6 | 2 | 13/16, 15/16 | 15/16, 16/16 |

On the first 36 questions, 6 passages fixed two Blue Cross lumbar questions that 4 missed in both runs. I then wrote the 20 held-out questions from the policy documents (`eval/chat_questions_heldout.json`, committed before they were run) to check whether that was real, and it was not: on questions I had not tuned against, 6 passages was no better than 4, so the earlier gain was partly fitted to the first set and the default stays at 4. (An earlier version of this README said the default was 6; that was premature.) With 16 questions, a difference of one or two answers is within the run-to-run variation I see.

Other held-out results (single run, same model): plain LLM without retrieval 6/16 answerable and 0/4 unanswerable handled; hard-coded policy table 1/16 and 4/4. Retrieval handled 4/4 unanswerable at 4 passages; at 6 it scored 3/4 in both runs, but the one "miss" (`h-na-cigna-bariatric`) is a correct refusal ("no bariatric surgery prior authorization criteria were returned") that my coarse pattern matcher did not recognise, so I left the score as the scorer gave it.

One question (`h-bcbssc-postop`: how long after surgery to wait before imaging for pseudarthrosis) failed in all four retrieval runs, at both settings. The passage exists and ranks 3rd for the literal question with the payer filter, but the model's own search wording (it adds payer names and boilerplate) pushes it to about 9th, so it never saw it. That is a weakness in how the chatbot phrases its searches, not in the corpus.

**Chunk-size ablation** (`python -m eval.ablation_eval`, same 34 queries, payer filter on / off; results in `eval/results/retrieval_ablation.json`):

| Chunk words (overlap) | Chunks | MRR, filter on | MRR, filter off |
|---|---|---|---|
| 80 (15) | 377 | 0.93 | 0.74 |
| 160 (30), current | 191 | 0.89 | 0.66 |
| 320 (60) | 97 | 0.91 | 0.74 |
| 640 (120) | 50 | 0.86 | 0.57 |
| 160 (0) | 157 | 0.90 | 0.65 |

With the payer filter, sizes from 80 to 320 words all reach Recall@5 of 1.00 and differ only slightly in MRR; very large chunks are worst, especially without the filter. Smaller chunks (80 words) did slightly better than the current 160 here, but with 34 queries a difference of a few hundredths is within noise, so the setting was not changed.

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
LLM provider (AI_PROVIDER): Groq (default openai/gpt-oss-120b) | Claude (Anthropic API) | Claude on Amazon Bedrock
```

The agent runner and UI are generic; each vertical (healthcare, legal, finance) is one module of tools, prompts and form fields. Only `healthcare` is registered.

---

## Setup

Prerequisites: Python 3.11+, Node 18+, and an API key for one provider: Groq (free tier is rate-limited, about 200k tokens/day), Anthropic (Claude), or an Amazon Bedrock API key.

```bash
# 1. Environment — .env in the project root
GROQ_API_KEY=your_groq_key_here
# GROQ_MODEL=openai/gpt-oss-120b   # optional override
# To use Claude or Bedrock instead, see .env.example (AI_PROVIDER=claude or bedrock,
# ANTHROPIC_API_KEY / CLAUDE_MODEL, or AWS_REGION / BEDROCK_MODEL_ID / AWS_BEARER_TOKEN_BEDROCK; use the inference profile ID, e.g. us.anthropic.claude-sonnet-4-6)

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

- Payer submission and payer decisions are simulated. Patient data is only the 100-patient open MIMIC-IV demo: hospital admissions, no outpatient notes, so conservative-therapy duration cannot be confirmed from a record. The policy-scan tool reports only retrieved passages (no hard-coded coverage rules); the payer portal and submission method are simulated.
- Small policy corpus (12 documents; Aetna, Medicare, two Blue Cross Blue Shield plans, UnitedHealthcare and Cigna site-of-care only, plus one benefits-manager guideline; no Humana or Medicaid, and no payer-specific lumbar-MRI criteria for UnitedHealthcare or Cigna).
- Sign-in is a prototype control, not production authentication: the demo PINs are public, there is no email verification or password reset, tokens last 8 hours and can only be invalidated by removing or changing the account, and anyone who can reach the server can create a staff account. With `MEDBRIDGE_AUTH=off` the reviewer name is free text.
- Not HIPAA-compliant. Do not enter real patient data, and do not send it to a free-tier LLM API.
- Generated appeals and answers are informational and need clinician review.

## Roadmap

Full MIMIC-IV (needs credentialed access) or Synthea for more patients, Humana and Medicaid policy documents, and checking the FHIR-shaped messages against the Da Vinci Prior Authorization Support profiles.

## Built With

[FastAPI](https://fastapi.tiangolo.com/) · [ChromaDB](https://www.trychroma.com/) · [sentence-transformers](https://www.sbert.net/) · [Groq](https://groq.com/) · [Claude](https://www.anthropic.com/claude) · [Amazon Bedrock](https://aws.amazon.com/bedrock/) · [React](https://react.dev/) + [Vite](https://vitejs.dev/)

Voice dictation: the request form has a Dictate button on the free-text fields (patient name, physician name, clinical justification), using the browser's built-in speech recognition (Chrome and Safari; not shown where unsupported). Audio is processed by the browser's speech service, so use demo data only. An external tool such as [Wispr Flow](https://wisprflow.ai/) also works but is not integrated.

## License

All Rights Reserved. See [LICENSE](LICENSE).
