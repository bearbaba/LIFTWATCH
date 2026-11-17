# LIFTWATCH

### Evidence Before Rollout — preregistered AI-consensus release decisions

**LIFTWATCH** is a GenLayer Intelligent Contract + analyst dashboard for A/B experiments that makes "we saw an uplift" insufficient to authorize a release. A product owner *preregisters* the hypothesis, primary metric, population, assignment plan and quantitative release thresholds. A separate analyst signs a single immutable report. Deterministic onchain math blocks unsupported claims; independent GenLayer AI validators evaluate the experimental method against the frozen plan. Only after both gates pass may the owner sign an **authorization record**.

> **Verified on GenLayer Studionet — 16 Nov 2026:** [LIFTWATCH V1.1 `0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106`](https://studio.genlayer.com/?import-contract=0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106) completed a signed, validator-accepted **REGISTERED → EVIDENCE_LOCKED → ELIGIBLE (3/3 AI methodology PASS) → AUTHORIZED** workflow. [Read-only GitHub Actions verification](https://github.com/bearbaba/LIFTWATCH/actions/runs/43865060771) independently confirms LATEST_FINAL authorization, deterministic quantitative gates, evidence citations and matching frozen plan/report hashes. All cohort data is **synthetic**; authorization is **non-executing**, not a real product release or independent analytics-provider audit.


## Live website demo — Trial #2 (17 Nov 2026)

[![Watch the end-to-end LIFTWATCH demo on YouTube](https://img.youtube.com/vi/BTvwC1kBBiI/hqdefault.jpg)](https://youtu.be/BTvwC1kBBiI)

**[▶ Watch the LIFTWATCH real-wallet demo (YouTube)](https://youtu.be/BTvwC1kBBiI)** · [Open the live app](https://liftwatch-ten.vercel.app)

The recorded browser walkthrough shows real MetaMask wallet interactions on GenLayer Studionet (chain 61999), the Owner and Analyst roles, and Trial #2 progressing through **REGISTERED → EVIDENCE_LOCKED → ELIGIBLE → AUTHORIZED**. It includes an AI methodology review (pre-registration, randomization and measurement all PASS) and on-screen finality/LATEST_FINAL readback. The [Trial #2 registration transaction](https://explorer-studio.genlayer.com/tx/0x0f1aa27fe5864184f888d8e819c4ca726c3f0e6be069937742a82f672146cefc) was reported as FINALIZED with accepted consensus, execution SUCCESS and return value `2`.

**Evidence boundary:** The video records test-network wallet interactions and synthetic cohort data. On-chain authorization is `NON_EXECUTING_RELEASE_DECISION`: it does not execute a production rollout or independently attest to analytics-provider data. The YouTube video is a demonstrative artifact; individual claims should be corroborated with GenLayer Explorer and `LATEST_FINAL` state.

## Signed on-chain acceptance — V1.1

**Contract:** [`0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106`](https://studio.genlayer.com/?import-contract=0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106) · GenLayer Studionet, chain 61999 · [Deployed source](contracts/liftwatch_v11.py) checked against actual RPC code at `LATEST_FINAL`.

| Accepted signed step | Explorer transaction | Recorded result |
| --- | --- | --- |
| Owner preregisters the unchanged experiment | [`preregister`](https://explorer-studio.genlayer.com/tx/0x194f9d7a739d8b016d185f2bd5fd771a77f9f102fd43694805d4e19a004376d2) | Trial #1 `REGISTERED`, plan SHA-256 committed |
| Independent analyst submits aggregate counts | [`submit_results`](https://explorer-studio.genlayer.com/tx/0x78e2cf3cfce6fb6415ebcc9353912922d566466fd50c751df9173679837e22b9) | `EVIDENCE_LOCKED`, all 4 deterministic safety/statistical gates pass |
| GenLayer validators assess locked methodology | [`assess_trial`](https://explorer-studio.genlayer.com/tx/0x3f412d0dd99f292a58b572a36dee5e537f5ceb5728d31dfe56411bd3b47f8fec) | `ELIGIBLE` · 3/3 AI criteria PASS · 1 assessment run · exact frozen citations |
| Owner approves, without executing a rollout | [`authorize_rollout`](https://explorer-studio.genlayer.com/tx/0x26fb2ece342f93af56e50cd32f6ad611502b228b64776def233ce6d0a998c16d) | `AUTHORIZED` with `NON_EXECUTING_RELEASE_DECISION` scope |

Every listed transaction is **FINALIZED / SUCCESS / Accepted**. The independently verified authorization record retains the exact preregistration SHA-256 `46ec3dd19755a41e4214e9a63db92e87a51d54d9be2ccd4f006629fcb7b0f024` and report SHA-256 `fd6a018f70b5cd93f16b7cebccb3c3faf0bcf42463967e2c8f4b0a8904ce9a4d`. [Automated live attestation](scripts/verify-live-v11.mjs) checks these commitments, all AI evidence references, the release decision scope and immutable signer roles.

**What V1.1 improves:** structured AI methodology checks are reduced to criterion/result/reason; the contract attaches literal references itself from frozen plan and report data. Technical-format `REVIEW` is safely retriable by the original analyst for at most three total assessment runs, while a substantive `REVIEW`, failing statistical gate or invalid wallet cannot bypass controls. This positive-path demo needed **no retry**. The older V1.0 on-chain trial is retained as historical state; V1.1 was deployed as a separate contract.

## Product thesis

Product teams routinely make three avoidable mistakes: deciding the success metric after seeing the result, misreading an attractive conversion uplift without adequate samples, and overlooking a deterioration in safety or error rates. Ordinary dashboards can calculate rates but cannot fairly interpret whether a signed analyst report follows a locked human-defined plan. Ordinary AI can interpret narrative methods but should not be trusted to overrule arithmetic.

**LIFTWATCH combines both:**

- Preregister **hypothesis, primary metric, population and randomization** in a wallet-signed frozen plan, bound to an independent analyst address.
- Lock the signed analyst's **six aggregate counts** and methods note with SHA-256. A report is immutable and may be submitted once per trial.
- Compute four integer-only gates without trusting an LLM: minimum sample per arm; minimum absolute conversion lift; approximate **two-sided 95% pooled two-proportion z-test**; and a maximum treatment-side error-rate increase.
- Use independent AI validators to check **pre-registration coherence, randomization claims and measurement integrity**. In V1.1 the contract attaches deterministic, exact evidence references; invalid AI format safely remains REVIEW.
- Produce `ELIGIBLE`, `HOLD` or `REVIEW`. **Even if the LLM says PASS, a failed quantitative gate forces HOLD.**
- Require an explicit owner wallet to change ELIGIBLE into `AUTHORIZED`, with exact preregistration/report SHA-256 receipts. This **does not deploy code or change production traffic**.

## End-to-end state machine

```text
OWNER:    preregister → REGISTERED
ANALYST:  submit_results → EVIDENCE_LOCKED
ANALYST:  assess_trial → ELIGIBLE | HOLD | REVIEW
ANALYST:  retry_format_review → only technical-format REVIEW (≤3 total runs)
OWNER:    authorize_rollout (only if ELIGIBLE) → AUTHORIZED
OWNER:    close_trial (assessed nonterminal states) → CLOSED
```

The owner and analyst **must be distinct wallets**. No retcon of thresholds after enrollment, no self-approval and no repeated reporting. A bounded **technical-format-only retry** cannot override substantive REVIEW/FAIL or quantitative HOLD. REVIEW remains non-authorizable.

## Math without ambiguity

Let `c` and `t` be control/treatment eligible users, `cc` and `tc` be conversions; `ce/te` denote errors. The contract uses integer cross-multiplication, with counts bounded to 1,000,000 per arm.

- Absolute lift in basis points: `(tc/t − cc/c) × 10,000`, compared without float rounding.
- Minimum sample and predeclared lift threshold must pass.
- For approximate two-sided 95% difference in proportions, require at least **5 expected pooled successes and 5 expected pooled failures in each arm**, then compute pooled z² and compare with **3.8416** using integers only. This still assumes independent randomized assignment.
- Error guardrail: treatment error-rate increase cannot exceed the **locked** maximum basis points.

The frontend mirrors the deterministic calculations with `BigInt`; the AI never computes or overrules these thresholds. The test is not a guarantee of generalizable uplift, multiple-testing corrections or causal effect. The mathematical result alone does not confirm the analyst's claimed observations are true; GenLayer consensus is **evidence-scoped**.

## Contract interface

| Method | Signer | Purpose |
| --- | --- | --- |
| `preregister` | Product owner | Locks hypothesis, design, independent analyst and release thresholds |
| `submit_results` | Analyst | Signs one report's counts and SHA-256 note |
| `assess_trial` | Analyst | Runs 3 AI methodology checks + deterministic statistical/safety gate |
| `retry_format_review` (V1.1) | Original analyst | Bounded retries only after verifiable technical schema fallback; no changed evidence |
| `authorize_rollout` | Product owner | Writes a **non-executing** authorization bound to both source hashes |
| `close_trial` | Product owner | Closes an assessed trial with a reason; no rollout |
| `get_trial`, `get_reference_bank`, `stats` | Anyone | Verifiable latest-final state and evidence ID mapping |

**AI model:** `gl.nondet.exec_prompt(prompt,response_format='json')`, normalized and checked again after `gl.eq_principle.prompt_comparative`. `checked_methodology` validates three distinct criteria, legal result enums and substantive reason bounds; exact frozen citations are constructed and verified by the contract, never generated by the AI model. Consensus still depends on validator interpretation; LLM rationales are not mathematical proof.

## Verified reviewer-facing application flow

The browser dashboard has a real **Studionet (61999) wallet connector and signed write path** powered by pinned `genlayer-js@1.1.8`. On opening the page it reads the already **AUTHORIZED** Trial #1 at `LATEST_FINAL`, displays the four deterministic statistical gates and an **Evidence Inspector** showing the AI decision, reasoning and frozen literal citations.

For new trials, independent Owner and Analyst accounts submit through wallet confirmation. The frontend now keeps the transaction hash across refreshes, waits for SDK `FINALIZED` and `FINISHED_WITH_RETURN`, confirms accepted consensus, and **re-reads the authoritative trial state** before displaying success. Network timeouts leave a resumable pending hash and block repeat writes; `Resume pending transaction verification` checks the *same* hash without signing. A wallet or chain change invalidates previous frontend signing authorization. The V1.1 format-only retry control is signer- and policy-gated.

**Proof boundary:** The original Trial #1 signed transactions were initiated from GenLayer Studio. Trial #2 has a [recorded browser-wallet walkthrough](https://youtu.be/BTvwC1kBBiI) showing Owner/Analyst signatures and the on-screen readback flow on the deployed website. Automated browser interaction tests still use simulated wallet/provider fixtures; those tests alone do **not** prove genuine user-wallet signatures. Check individual hashes and `LATEST_FINAL` state independently for transaction-level verification.

## Quick start

The `web/` dashboard contains local sample metrics, experiment preregistration, data-entry form, integer-only real-time analysis, wallet-signing actions, and contract-state verification. It displays **EXAMPLE DATA · NO CHAIN PROOF** unless the read-only live query succeeds. The V1.1 contract is prefilled for convenience and current `LATEST_FINAL` state is loaded when the dashboard opens; signing remains controlled by wallet ownership.

```bash
# Standalone static design preview (requires only Python)
python -m http.server 5173 --directory web
# visit http://localhost:5173

# Wallet-enabled live interface (requires npm network/package registry)
npm install
npm run dev

# Tests and build
python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.mjs
python -m py_compile contracts/liftwatch.py contracts/liftwatch_v11.py
npm run build
npm run schema:studionet
```

GenLayerJS is pinned via `genlayer-stable: npm:genlayer-js@1.1.8`. Offline npm install failure is **not** equivalent to a successful build or SDK attestation.

## Example cohort (fictional)

The preregistered trial uses a persistent randomization plan, 2,500 users in each arm, a conversion goal of +150 bps, and an error-rate guardrail of +100 bps. The illustrative results are **300/2,500** conversions for control and **400/2,500** for treatment, with **22** versus **24** errors. The deterministic gates pass for this *example*. Signed V1.1 on-chain methodology PASS has been independently verified for this fictional cohort; self-reported methods notes are **not** independent analytics-provider verification.

[**Studio acceptance guide**](docs/STUDIO_ACCEPTANCE.md) · [**Security/trust model**](docs/SECURITY_MODEL.md)

## Integrity and scope

This is an **authorization ledger**, not an actual feature deployment service, statistical consulting certification, A/B testing analytics provider, investment/trading tool, and not a live production traffic switch. Missing allocation logs, cohort timestamps, sample ratio diagnostics or multiple-testing corrections can invalidate causal interpretation despite arithmetic success. Use independent signed/provider-backed evidence in a production integration.

The [GitHub Actions checks](https://github.com/bearbaba/LIFTWATCH/actions) run 59 Python tests and 14 JavaScript tests, frontend production build, contract syntax, GenLayer ABI/schema validation and **live V1.1 authorization attestation**. The current test suite covers sample thresholds, z² arithmetic, guardrails, wallet roles, consent to release, false evidence IDs, hash mismatch, snapshot tampering and fail-closed outcomes. **The accepted V1.1 PASS and AUTHORIZED judgments are documented above; they certify this signed evidence-scoped demonstration, not real-world causal impact.**

**License:** MIT, see [LICENSE](LICENSE).
