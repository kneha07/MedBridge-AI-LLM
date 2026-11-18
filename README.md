# MedBridge — AI Prior Authorization Agent

> Prior authorization drafted in minutes, with cited policy evidence. A person approves before anything is sent.

> 🏆 **1st Place Winner** — AI Agents Hackathon, hosted by OSS4AI in collaboration with Beta Fund and Gravitational Ventures | Solo build. This repository extends that prototype as a course project (INFO 7375, Northeastern).

**Problem.** In 2024, Medicare Advantage insurers fully or partially denied 4.1 million prior-authorization requests. Of the denials that were appealed, 80.7% were overturned in whole or in part, yet only 11.5% were appealed at all ([KFF](https://www.kff.org/medicare/medicare-advantage-insurers-made-nearly-53-million-prior-authorization-determinations-in-2024/)). Each request takes work: reading the payer's policy, finding the evidence in the chart, filling the forms. Physicians report 43 requests a week, about 12 hours of physician and staff time ([AMA](https://www.ama-assn.org/press-center/press-releases/ama-survey-indicates-prior-authorization-wreaks-havoc-patient-care)). MedBridge gives that work to an AI agent that reads the payer's own published policies, checks the patient's record against them, and drafts the request and, after a denial (simulated in this prototype), an appeal. The agent cannot submit anything without a human reviewer, who sees the cited policy passages and, for patients with an outpatient history, a timeline of their therapy against the duration the policy asks for. The order of steps is enforced in code, not only in the prompt. Payers are simulated and patients are synthetic or de-identified; MedBridge prepares the case, and a clinician decides.

MedBridge is an LLM agent for clinic staff. It scans a payer's policy, analyzes the patient's records, completes the authorization form, **pauses for human approval**, then submits and tracks the request. If the payer denies it, the agent drafts an appeal that cites the retrieved policy text. A separate chatbot answers coverage questions from the same policy documents, with sources.

**Model options.** The agent and the chatbot run on **Groq**, **Claude** (Anthropic API) or **Claude on Amazon Bedrock**, chosen with one setting (`AI_PROVIDER`). The evaluations so far were run on Groq; the Claude and Bedrock paths are implemented. The Bedrock path (`us.anthropic.claude-sonnet-4-6`) has only been smoke-tested (one agent run per scenario, three chat questions, no errors), so full results are still to be added.

**Status: research prototype.** Payer submission (EDI 278) and payer decisions are **simulated**; nothing is sent to a real payer. Patient records come from the open MIMIC-IV demo (100 real, de-identified patients; hospital-admission data only), from Synthea synthetic patients, or from an uploaded FHIR bundle, which is kept in memory for two hours and never saved. It must not be used with real patient data.

---

## Why this problem

- In an AMA survey of 1,000 physicians (fielded December 2023, published June 2024), 94% said prior authorization delays necessary care, 24% reported a serious adverse event for a patient, and physicians reported completing an average of 43 requests a week, equal to about 12 hours of physician and staff time ([AMA](https://www.ama-assn.org/press-center/press-releases/ama-survey-indicates-prior-authorization-wreaks-havoc-patient-care); the AMA opposes prior authorization).
- In 2024 Medicare Advantage insurers fully or partially denied 4.1 million of 52.8 million requests; 80.7% of appeals were partially or fully overturned, but only 11.5% of denials were appealed ([KFF](https://www.kff.org/medicare/medicare-advantage-insurers-made-nearly-53-million-prior-authorization-determinations-in-2024/)).
- Wait times are contested: in an AMA survey (2017 data), about two-thirds of physicians waited at least one business day for a decision and roughly 30% waited three days or longer ([AMA](https://ama-assn.org/survey-patient-clinical-outcomes-shortchanged-prior-authorization)); insurer-reported medians are about one day ([KFF](https://www.kff.org/patient-consumer-protections/prior-authorization-metrics-provide-new-insights-into-insurer-practices-but-gaps-remain/)).
- CAQH Index 2019: a manual prior authorization cost providers $10.92 versus $1.88 electronically ([summary](https://blog.quadax.com/key-takeaways-from-the-2019-caqh-index)).

---

## Demo

[Explainer video (63 s, MP4)](presentation/MedBridge_explainer.mp4): an animated walk-through of the current version: the problem, an agent run with the approval gate, the tool-order guard and the evaluation results. The run shown in the video is an illustration with demo data, not a screen recording.

[Demo video of the hackathon prototype](https://drive.google.com/file/d/1cygGQlXmpLLv3FvAu5zmC6dwqmULOCZ2/view?usp=drive_link) (earlier version: no approval step, chatbot or real policy corpus). The screenshots in `frontend/src/assets` are from that version too.

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
| **Open patient data** | `analyze_medical_records` looks the patient up in the MIMIC-IV demo (SQLite) and reports diagnoses, procedures and analgesic/NSAID medications on record, with its limits. Synthea synthetic patients (optional, `python -m synthea_loader`) add the outpatient back-pain history MIMIC lacks: first back-pain diagnosis, back-pain visits, and weeks of conservative therapy from prescription and physical-therapy dates. |
| **Upload a patient record** | Drop a FHIR R4 patient bundle (or pick one of three sample patients) on the request form. `fhir_import.py` turns it into the same record the Synthea loader builds, keeps it in server memory for two hours (never in the database), and fills the patient fields and diagnosis code. FHIR prescriptions carry no stop date, so a completed one counts as a single day rather than an invented duration. Checked against Synthea's own FHIR export: on the 89 back-pain patients whose histories agree between the CSV and FHIR runs, diagnoses, visits, therapy sessions, prescription dates and imaging match, and weeks of therapy are never higher than from the CSV. Tests: `backend/tests/test_fhir_import.py`. |
| **Therapy timeline on the review screen** | For outpatient records, the review screen draws back-pain visits, therapy sessions, prescriptions and imaging on a timeline, with the duration the cited policy passage asks for (e.g. Aetna's "4 weeks of conservative therapy", read from the retrieved text, not hard-coded) and a checklist item comparing the two. |
| **Tool order enforced in code** | `SequenceGuard` in `agent_runner.py` refuses a tool called before its prerequisites (the model gets an error naming the step to call instead), refuses a second `submit_authorization`, allows `draft_appeal` only after a denial, and nudges the model up to twice if it stops before all steps have run. Each refusal, nudge or unfinished run is recorded in the request's audit trail and shown live on the progress screen, next to the enforced order. Tests: `backend/tests/test_sequence_guard.py`. |
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

**Shorter search queries (tried, not adopted).** One failure (`h-bcbssc-postop`) happened because the model's own search wording, which adds payer names and boilerplate, pushed the right passage from 3rd to about 9th. I tried a prompt rule asking for short topical queries without the payer name (`CHAT_SHORT_QUERIES=1`, off by default) and tested it on all three question sets, two runs each. The third set (`eval/chat_questions_set3.json`, 15 questions) was written and committed before the rule existed.

| Answerable questions correct | Current prompt (2 runs) | Short-query rule (2 runs) |
|---|---|---|
| First set, 30 | 27, 27 | 25, 25 |
| Held-out set, 16 | 14, 15 | 16, 16 |
| Third set, 12 (written before the rule) | 9, 9 | 9, 8 |
| **All 58** | **50, 51** | **50, 49** |

The rule fixed the question it was designed from and made the held-out set perfect, but that set is where I found the problem, so it is not a fair test. On the clean third set it did no better, and on the first set it lost two questions in both runs (`bcbsla-ddd`, `hh-compression`). Overall it is no better than the current prompt within run-to-run variation, so it stays off. A pattern worth following up instead: most of the persistent misses are questions about the Blue Cross Blue Shield of South Carolina policy (`bcbs-4wk`, `h-bcbssc-postop`, `s3-bcbssc-dimple`, `s3-bcbssc-ankylosing`), which is the longest document and shares the payer filter with the Louisiana policy.

**Chunk-size ablation** (`python -m eval.ablation_eval`, same 34 queries, payer filter on / off; results in `eval/results/retrieval_ablation.json`):

| Chunk words (overlap) | Chunks | MRR, filter on | MRR, filter off | Passage MRR@20 | Passage Recall@5 |
|---|---|---|---|---|---|
| 80 (15) | 377 | 0.93 | 0.74 | 0.50 | 0.74 |
| 160 (30), current | 191 | 0.89 | 0.66 | 0.60 | 0.84 |
| 320 (60) | 97 | 0.91 | 0.74 | 0.66 | 0.93 |
| 640 (120) | 50 | 0.86 | 0.57 | 0.74 | 0.93 |
| 160 (0) | 157 | 0.90 | 0.65 | 0.57 | 0.81 |

With the payer filter, sizes from 80 to 320 words all reach Recall@5 of 1.00 and differ only slightly in MRR; very large chunks are worst, especially without the filter. Smaller chunks (80 words) did slightly better than the current 160 here, but with 34 queries a difference of a few hundredths is within noise, so the setting was not changed.

**Passage-level retrieval** (`python -m eval.passage_eval`, the 69 answerable chat questions, payer filter on; results in `eval/results/passage_eval.json`): a hit requires the retrieved chunk to contain the answer, not only to come from the right document. At the current chunk size, document Recall@1 is 0.87 but passage Recall@1 is 0.42 (Recall@5 0.84). The passage columns in the table above favour larger chunks, partly because an answer is less often split across two chunks and partly because a larger chunk contains more text by construction; the two metrics point in opposite directions, so the chunk size was left at 160 words.

**Keyword + embedding search (added, not yet evaluated).** `RAG_HYBRID=1` merges the embedding ranking with a keyword (BM25) ranking over the same payer-filtered chunks by reciprocal rank fusion (`backend/rag/hybrid.py`, tests in `backend/tests/test_hybrid.py`). It is aimed at the persistent misses in the long Blue Cross Blue Shield of South Carolina policy, where the right passage ranks below more general ones. It is off by default and has not been run on any question set yet, so there are no numbers for it and the default stays unchanged until there are.

---

## Architecture

```
React (Vite) ── sign-in · chat · request form · review screen · history · team
      │ HTTP (+1.5 s polling, bearer token)
FastAPI ── /api/auth/* · /api/users/* · /api/chat · /api/workflow/* · SQLite (requests, steps, audit, accounts)
      │
Agent runner ── LLM → tool call → observe → repeat
      │            (pauses at approval-required tools)
      ├── Healthcare vertical: 6 tools (patient records from the MIMIC-IV demo; payer responses and a FHIR-shaped Claim/ClaimResponse simulated)
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
python -m synthea_loader             # optional: load Synthea synthetic patients (generate the CSVs first; see the top of synthea_loader.py)
python -m uvicorn main:app --port 8000   # `python -m` makes sure the venv's packages are used

# 3. Frontend
cd frontend
npm install
npm run dev                          # http://localhost:5173
```

Sign-in is on by default. Open http://localhost:5173 and use a demo account (`alice` / `2468` is a reviewer, `bob` / `1357` is staff), or create your own account. Set `MEDBRIDGE_AUTH=off` in `.env` to turn sign-in off.

Docker: `docker compose up --build` starts both services for development (the corpus, index and patient data still have to be built once; the command is at the top of `docker-compose.yml`). The Docker setup has not been run end to end since it was rewritten.

### Tests and evaluations

```bash
cd backend
python -m pytest tests                                   # 50 unit tests: FHIR mock, FHIR upload, sign-in, roles, accounts, tool order, keyword ranking (no LLM calls)
python -m eval.retrieval_eval                            # retrieval: Recall@k and MRR over 34 queries
RAG_HYBRID=1 python -m eval.retrieval_eval               # the same with keyword + embedding search (experiment, see below)
python -m eval.passage_eval                             # retrieval at passage level (does the chunk contain the answer)
python -m eval.ablation_eval                             # chunk-size and overlap ablation (document and passage level)
python -m eval.agent_eval --provider bedrock --runs 5    # agent tool sequence (needs provider credentials)
python -m eval.chat_eval --provider bedrock --mode both  # chatbot, 36 questions, with vs without retrieval
python -m eval.chat_eval --provider bedrock --mode static  # ablation: hard-coded table instead of retrieval
python -m eval.chat_eval --questions chat_questions_heldout.json --provider bedrock --mode rag   # also: _set3, _set4
```

The chat questions are in four files in `backend/eval/` (36, 20, 15 and 14 questions). They were written by an AI assistant from the policy documents and spot-checked, scoring is deliberately coarse, and each file was committed before it was run, so treat the numbers as a sanity check and not a benchmark.

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/config` | Whether sign-in is on, the roles, and the public demo accounts. |
| `POST` | `/api/auth/login` | Body: `{"username": "...", "password": "..."}` (the PIN for demo accounts). Returns a bearer token. |
| `POST` | `/api/auth/register` | Body: `{"full_name", "email", "organization", "password"}`. Creates a staff account and returns a token. |
| `GET` | `/api/users` | Reviewers only. The team and their roles. |
| `POST` | `/api/users/{name}/role` | Reviewers only. Body: `{"role": "reviewer" or "staff"}`. |
| `POST` | `/api/chat` | Policy chatbot. Body: `{"messages":[{"role":"user","content":"..."}]}`. Returns reply, citations, tools used. |
| `POST` | `/api/workflow/submit` | Start a prior-auth request. |
| `GET` | `/api/workflow/{id}/status` | Status, steps and audit trail. Status `awaiting_approval` means the agent is paused. |
| `POST` | `/api/workflow/{id}/approve` | Body: `{"approved": true, "reviewer": "...", "note": "..."}`. |
| `GET` | `/api/workflow/history/all` | Saved requests. |
| `POST` | `/api/demo/reset` | Clear all saved requests (reviewers only when sign-in is on). The app's buttons no longer call it; use it deliberately, for example with `curl`. |
| `GET` | `/health` | Health check. |

With sign-in on, the chat, workflow, history, team and reset endpoints need the header `Authorization: Bearer <token>`. `/health`, `/api/auth/*` and `/api/verticals` (the form definition) are public.

---

## Limitations

- Payer submission and payer decisions are simulated. Patient data is only the 100-patient open MIMIC-IV demo: hospital admissions, no outpatient notes, so conservative-therapy duration cannot be confirmed from a record. Synthea patients do carry therapy durations, but they are synthetic, and Synthea does not model sciatica, radiculopathy or lumbar imaging. The policy-scan tool reports only retrieved passages (no hard-coded coverage rules); the payer portal and submission method are simulated.
- Small policy corpus (12 documents; Aetna, Medicare, two Blue Cross Blue Shield plans, UnitedHealthcare and Cigna site-of-care only, plus one benefits-manager guideline; no Humana or Medicaid, and no payer-specific lumbar-MRI criteria for UnitedHealthcare or Cigna).
- Sign-in is a prototype control, not production authentication: the demo PINs are public, there is no email verification or password reset, tokens last 8 hours and can only be invalidated by removing or changing the account, and anyone who can reach the server can create a staff account. With `MEDBRIDGE_AUTH=off` the reviewer name is free text.
- The chatbot sometimes misses an answer that is in the corpus: it writes its own search query, and answers inside long policies (the Blue Cross Blue Shield of South Carolina one in particular) can rank below passages of shorter, more general documents. Evaluation sets are small and hand-written (see above).
- Not HIPAA-compliant. Do not enter real patient data, and do not send it to a free-tier LLM API.
- Generated appeals and answers are informational and need clinician review.

## Roadmap

Full MIMIC-IV (needs credentialed access) for more real patients, Humana and Medicaid policy documents, and checking the FHIR-shaped messages against the Da Vinci Prior Authorization Support profiles.

## Built With

[FastAPI](https://fastapi.tiangolo.com/) · [ChromaDB](https://www.trychroma.com/) · [sentence-transformers](https://www.sbert.net/) · [Groq](https://groq.com/) · [Claude](https://www.anthropic.com/claude) · [Amazon Bedrock](https://aws.amazon.com/bedrock/) · [React](https://react.dev/) + [Vite](https://vitejs.dev/)

Voice dictation: the request form has a Dictate button on the free-text fields (patient name, physician name, clinical justification), using the browser's built-in speech recognition (Chrome and Safari; not shown where unsupported). Audio is processed by the browser's speech service, so use demo data only. An external tool such as [Wispr Flow](https://wisprflow.ai/) also works but is not integrated.

## License

All Rights Reserved. See [LICENSE](LICENSE).
