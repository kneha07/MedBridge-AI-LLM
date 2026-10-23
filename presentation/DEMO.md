# MedBridge — Demo & Presentation

## Demo Link

https://drive.google.com/file/d/1cygGQlXmpLLv3FvAu5zmC6dwqmULOCZ2/view?usp=drive_link

## Slides

[MedBridge_Presentation_Deck.pdf](MedBridge_Presentation_Deck.pdf)

## Video Walkthrough

https://drive.google.com/file/d/1cygGQlXmpLLv3FvAu5zmC6dwqmULOCZ2/view?usp=drive_link

---

## Video Demo Script (3–5 min)

---

### INTRO — 30 sec
*(show the homepage)*

"Hi, my name is Neha Kumari. I'm a Computer Science student at Northeastern University, and today I'm presenting MedBridge — an AI agent that automates healthcare prior authorization, end to end."

---

### THE PROBLEM — 45 sec
*(still on homepage)*

"Let me start with the problem.

Every time a physician orders an MRI, a surgery, or a specialist referral — the insurance company requires prior authorization before they'll pay. And the process today is completely broken.

Staff manually fills out 10-plus-page forms and faxes them to insurance portals. Yes — still fax, in 2026. Payers take 3 to 5 business days just to respond. 1 in 5 requests gets denied — and when that happens, staff spends another 2 to 3 days drafting an appeal letter, pulling clinical notes, citing guidelines, and getting physician sign-off.

The American Medical Association estimates this costs the U.S. healthcare system **$19.7 billion every single year.** Not because the process is medically complex — but because humans are doing work that AI should be doing."

---

### THE SOLUTION + WEB UI — 40 sec
*(point to the form / scroll to it)*

"So that's what MedBridge solves.

MedBridge is the AI agent layer on top of existing payer portals. You fill out **one form** — right here in the web app. The agent handles everything else: scanning payer policies, analyzing the patient's medical records, filling and submitting the authorization, tracking the decision in real time, and if it gets denied — automatically drafting the appeal.

The web UI is built in React with Vite. It polls the backend every 1.5 seconds, so every agent step appears live on screen as it happens — you watch the AI think and act in real time. There's nothing to install, nothing to configure. One form. Submit. Done.

No fax. No waiting. No back and forth."

---

### TECH STACK — 45 sec
*(still on the web app)*

"Before I run the demo, a quick look under the hood — because the engineering choices here are deliberate.

**Frontend:** React with Vite. Polls the backend every 1.5 seconds so every agent step appears live as it happens — no page refresh, no manual checks.

**Backend:** FastAPI in Python 3.11. Two core endpoints: submit a workflow, poll its status. Lightweight, fast, production-ready.

**The AI core:** Groq's API running LLaMA 3.3-70B. This is a real tool-use loop — the model receives descriptions of six healthcare tools, decides which one to call next, observes the result, and keeps going until the job is done. It is not a chatbot. It is not a hardcoded sequence. The model is making decisions at every step.

**Compliance layer:** HIPAA-aware, CMS 2026 prior auth API standards, EDI 278 for electronic submission. Five major payers supported — Aetna, BCBS, UHC, Cigna, and Humana.

The whole system is designed so adding a new healthcare workflow — step therapy exceptions, specialist referrals, medication appeals — is just one Python module."

---

### DEMO SETUP — 20 sec
*(point to the form)*

"I'm going to click Try Demo to auto-fill a real patient scenario."

*(click Try Demo)*

"This is Margaret Thompson — she needs a lumbar spine MRI, she's insured through Aetna, and her diagnosis code is M72.5."

---

### SCENARIO 1 — STANDARD APPROVAL — 60–75 sec
*(select Standard Approval, hit Submit)*

"I'll run the Standard Approval scenario first. I hit Submit — and now watch what happens."

*(as steps appear, narrate each one)*

- **Step 1 — Policy scan:** "The agent is pulling Aetna's coverage criteria for lumbar MRIs — what clinical requirements they need, what documentation they want."
- **Step 2 — Records analysis:** "Now it's analyzing Margaret's patient history — establishing medical necessity based on her records."
- **Step 3 — Form fill:** "It's auto-populating the authorization form. 96% completeness — no missing fields, no back-and-forth."
- **Step 4 — Submission:** "Submitting via EDI 278 — the standard electronic format payers actually accept. No fax."
- **Step 5 — Status tracking:** "Checking the initial decision and setting up real-time monitoring."

*(result appears)*

"Authorization confirmed. That entire workflow — what normally takes hours across multiple days — done in seconds."

---

### SCENARIO 2 — DENIAL + AUTO-APPEAL — 90 sec
*(click Try Demo again, select Denial + Auto-Appeal, hit Submit)*

"Now let me show you the part that makes MedBridge different. This is the denial scenario."

*(as steps run)*

"Same workflow — but this time Aetna comes back with a denial. Denial code CO-50 — medical necessity not established.

In the real world, this is where staff spends the next 2 to 3 days drafting an appeal letter, pulling clinical notes, citing guidelines, getting physician sign-off.

Watch what MedBridge does."

*(appeal step runs)*

"The agent reads the denial code, pulls supporting clinical evidence from Margaret's record — her VAS pain scores, failed conservative treatments, office notes — and generates a formal CMS-compliant appeal letter. Queued for physician co-signature and ready to submit.

That 2-to-3-day workflow — done in seconds, automatically."

---

### CLOSE — 20 sec

"MedBridge is the agent layer on top of existing payer portals. No infrastructure replacement. Just AI doing the work that humans shouldn't have to do.

$19.7 billion problem. Six tools. Seconds — not days.

Thank you."

---

### Setup
1. Start the backend and frontend (see [README](../README.md#setup))
2. Open [http://localhost:5173](http://localhost:5173)

### Scenario 1 — Standard Approval
1. Click **"✨ Try Demo"** to auto-fill Margaret R. Thompson's info
2. Select **Standard Approval** scenario
3. Hit **Submit** and watch the agent work through all 6 steps in real time
4. Result: Authorization confirmed

### Scenario 2 — Denial + Auto-Appeal
1. Click **"✨ Try Demo"** again
2. Select **Denial + Auto-Appeal** scenario
3. Submit — agent hits a denial (CO-50), then immediately drafts a clinical appeal
4. Result: Appeal letter generated with supporting evidence, ready for physician sign-off

---

## Key Talking Points

- **Real agentic loop** — LLM chooses tools dynamically, not a hardcoded script
- **Denial auto-appeal** — 2–3 day staff workflow done in seconds
- **$19.7B problem** — AMA 2023, administrative burden on U.S. healthcare
- **Vertical platform** — adding a new workflow = one Python module
