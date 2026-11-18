# MedBridge: demo and presentation

## Video

[MedBridge_explainer.mp4](MedBridge_explainer.mp4): a 63-second animated explainer of the current version. The agent run in it is an illustration with demo data, not a screen recording.

## Live demo script (about 4 minutes)

Setup: start the backend and frontend (see [README](../README.md#setup)), open http://localhost:5173 and sign in as `bob` / `1357` (staff). Keep a second browser window signed in as `alice` / `2468` (reviewer).

### 1. The problem (30 s)

In 2024 Medicare Advantage insurers denied 4.1 million prior-authorization requests in full or in part. Only 11.5% of those denials were appealed, and 80.7% of the appeals were overturned (KFF). Each request means reading the payer's policy, finding the evidence in the chart and filling the forms; physicians report 43 requests a week, about 12 hours of physician and staff time (AMA).

### 2. What MedBridge does (30 s)

An LLM agent reads the payer's own published policy, checks the patient record against it and drafts the request. It cannot submit anything without a human reviewer. Payers are simulated and patients are synthetic or de-identified.

### 3. Standard request (75 s)

1. As `bob`, pick a sample patient on the request form (or use the demo patient) and submit.
2. Narrate the steps as they appear: policy scan with cited passages, record analysis, form fill.
3. The run stops at the approval step. Switch to `alice`, open the review screen, show the cited policy passages and the therapy timeline, and approve.
4. The agent submits (a FHIR-shaped claim, simulated) and tracks the decision.

### 4. Denial and appeal (60 s)

Run the denial scenario. After the simulated denial, the agent drafts an appeal that cites the retrieved policy text. Point out that the appeal still needs physician review.

### 5. Guardrails and evidence (45 s)

- The order of steps is enforced in code (`SequenceGuard`): a tool called too early is refused, and each refusal is in the audit trail.
- Nobody can approve a request they submitted; the approver's name comes from the signed token.
- Chatbot evaluation on 30 answerable questions: 27 correct with retrieval, 22 for a plain LLM, 11 for the hard-coded policy table (Claude Sonnet 4.6 on Amazon Bedrock).
- On 64 real lumbar-MRI denial reviews from California, retrieval returned a spine-MRI policy at rank 1 for 94% of cases.

### 6. Limits (20 s)

Research prototype: payer submission and decisions are simulated, the policy corpus is small (12 documents), and it is not HIPAA-compliant. It must not be used with real patient data.
