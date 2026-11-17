# LIFTWATCH — Project Submission & Verification Evidence

**Submission date:** 17 November 2026  
**Contribution:** Builder → Projects → Project Explorer  
**Project:** LIFTWATCH — Evidence Before Rollout  
**Network:** GenLayer Studionet (Chain ID `61999`)

## Project overview

LIFTWATCH is a working GenLayer Intelligent Contract and web application for evidence-gated A/B experiment decisions. A Product Owner preregisters the hypothesis, metric, cohort design and decision thresholds; a separate Analyst signs and locks an outcome report. The contract enforces deterministic statistical and safety checks, while GenLayer AI validators independently assess **pre-registration, randomization and measurement** against frozen evidence with traceable references. An eligible trial requires a separate Owner-signed authorization.

The authorization is a **non-executing on-chain decision record**, **not** an automatic deployment or production traffic change.

## Primary evidence — live Trial #2

| Evidence | Direct link | What to verify |
| --- | --- | --- |
| **Full real-wallet demo (YouTube)** | [Watch the end-to-end LIFTWATCH video](https://youtu.be/BTvwC1kBBiI) | Website interactions, real MetaMask approvals from Owner and Analyst, live GenLayer consensus/finality tracking, and Trial #2 readback |
| **Live web app** | [liftwatch-ten.vercel.app](https://liftwatch-ten.vercel.app) | Working frontend, Studionet wallet connection, read-only `LATEST_FINAL` trial inspection, evidence and AI review screens |
| **Source repository** | [github.com/bearbaba/LIFTWATCH](https://github.com/bearbaba/LIFTWATCH) | Source, contract, verification scripts, tests and deployment documentation |
| **Intelligent Contract V1.1** | [Deployed contract on GenLayer Studio](https://studio.genlayer.com/?import-contract=0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106) | Deployed LIFTWATCH contract on Studionet |
| **Trial #2 preregistration transaction** | [GenLayer Explorer — `0x0f1aa27f…146cefc`](https://explorer-studio.genlayer.com/tx/0x0f1aa27fe5864184f888d8e819c4ca726c3f0e6be069937742a82f672146cefc) | `preregister`, `FINALIZED`, accepted consensus, GenVM execution success, return value `2` |
| **Contract source (V1.1)** | [contracts/liftwatch_v11.py](https://github.com/bearbaba/LIFTWATCH/blob/main/contracts/liftwatch_v11.py) | Actual Intelligent Contract logic, signer roles, deterministic gates, AI review and authorization |
| **Continuous integration** | [GitHub Actions](https://github.com/bearbaba/LIFTWATCH/actions) | Contract tests, frontend checks, build, Studionet schema and read-only verification workflows |

**Recorded Trial #2 lifecycle:**

`REGISTERED → EVIDENCE_LOCKED → ELIGIBLE → AUTHORIZED`

The accompanying video records four signed actions on the website: `preregister` (Owner), `submit_results` (Analyst), `assess_trial` (Analyst / GenLayer AI methodology review) and `authorize_rollout` (Owner). The video displays `FINALIZED`, successful execution/consensus, and `LATEST_FINAL` state verification. To independently verify current contract state, follow the instructions below. Transaction hashes for the last three Trial #2 actions are not asserted here because they have not been transcribed into this evidence document.

## Independent reviewer verification — no wallet signature needed

1. Open the [LIFTWATCH website](https://liftwatch-ten.vercel.app).
2. Select **On-chain console**. Set the contract address to `0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106` and **Trial ID** to `2`.
3. Click **Read LATEST_FINAL**. The expected state for the recorded demo is **`AUTHORIZED`**.
4. Open **Evidence ledger** to inspect the signed report and deterministic sample, lift, significance and error-rate checks.
5. Open **Report & AI review** to inspect the methodology verdict and its frozen evidence references. The recorded Trial #2 review shows **PASS** for pre-registration, randomization and measurement.
6. Compare the [recorded Trial #2 registration transaction](https://explorer-studio.genlayer.com/tx/0x0f1aa27fe5864184f888d8e819c4ca726c3f0e6be069937742a82f672146cefc) against Explorer, and use the [full video](https://youtu.be/BTvwC1kBBiI) to inspect the additional signed stages.

A wallet is only required if the reviewer chooses to submit a **new** transaction. The existing trial can be inspected through read-only functions.

## Additional established on-chain proof — Trial #1

The repository documents an earlier complete accepted workflow on the **same V1.1 deployed contract**. These four transaction links provide independently inspectable examples of each contract method:

| Signed action | GenLayer Explorer | Documented result |
| --- | --- | --- |
| Owner preregistration | [Transaction](https://explorer-studio.genlayer.com/tx/0x194f9d7a739d8b016d185f2bd5fd771a77f9f102fd43694805d4e19a004376d2) | `REGISTERED` |
| Analyst submits evidence | [Transaction](https://explorer-studio.genlayer.com/tx/0x78e2cf3cfce6fb6415ebcc9353912922d566466fd50c751df9173679837e22b9) | `EVIDENCE_LOCKED` |
| GenLayer AI methodology review | [Transaction](https://explorer-studio.genlayer.com/tx/0x3f412d0dd99f292a58b572a36dee5e537f5ceb5728d31dfe56411bd3b47f8fec) | `ELIGIBLE` with three AI criteria PASS |
| Owner authorization | [Transaction](https://explorer-studio.genlayer.com/tx/0x26fb2ece342f93af56e50cd32f6ad611502b228b64776def233ce6d0a998c16d) | `AUTHORIZED`, non-executing decision |

A [read-only V1.1 verification workflow](https://github.com/bearbaba/LIFTWATCH/actions/runs/43865060771) is also linked in the repository README. Trial #1 proof is supplementary; **the YouTube walkthrough demonstrates the more recent Trial #2 signed from the website itself**.

## Technical details and trust boundaries

- **GenLayer is essential:** Intelligent Contract writes, independent AI methodology evaluation, validator consensus and `LATEST_FINAL` reads are part of the core workflow, not a decorative integration.
- **Independent roles:** Product Owner and Analyst must use different wallet addresses; authorization is permitted only from a verified eligible state.
- **Deterministic gates:** Minimum sample size, minimum uplift, approximate two-sided pooled proportion significance test, and treatment error-rate guardrail are evaluated with integer arithmetic.
- **Evidence commitments:** The registered plan and signed report are frozen and checked using SHA-256 commitments; AI methodology assessments include fixed evidence references.
- **Safe transaction UX:** The website displays wallet/submission/consensus/finality/readback states, retains pending transaction hashes, and avoids treating a network timeout as confirmed failure or submitting duplicates automatically.
- **Limits:** The cohort figures are **synthetic**, not independently sourced analytics-provider measurements; methodology PASS is an evidence-scoped validator judgment, not causal certification. This is **Studionet**, not a production/mainnet release system. The `AUTHORIZED` result does **not** deploy code or change live product traffic.

## Links to copy into Project Explorer

- **Website:** https://liftwatch-ten.vercel.app
- **GitHub:** https://github.com/bearbaba/LIFTWATCH
- **Demo:** https://youtu.be/BTvwC1kBBiI
- **Contract:** https://studio.genlayer.com/?import-contract=0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106
- **Trial #2 registration proof:** https://explorer-studio.genlayer.com/tx/0x0f1aa27fe5864184f888d8e819c4ca726c3f0e6be069937742a82f672146cefc