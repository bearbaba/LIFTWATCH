# LIFTWATCH

### Evidence Before Rollout — preregistered AI-consensus release decisions

**LIFTWATCH** is a GenLayer Intelligent Contract + analyst dashboard for A/B experiments that makes "we saw an uplift" insufficient to authorize a release. A product owner *preregisters* the hypothesis, primary metric, population, assignment plan and quantitative release thresholds. A separate analyst signs a single immutable report. Deterministic onchain math blocks unsupported claims; independent GenLayer AI validators evaluate the experimental method against the frozen plan. Only after both gates pass may the owner sign an **authorization record**.

> **Build status — 16 Nov 2026:** runnable source and responsive UI are prepared with security tests and CI configuration. **Not yet deployed to Studionet. No accepted onchain PASS or AUTHORIZED claim is made.** Preloaded conversion metrics are fictional and explicitly labeled as illustrative local data. The internal 9.5/10 target requires verified signed execution on a fresh deployed contract.

## Product thesis

Product teams routinely make three avoidable mistakes: deciding the success metric after seeing the result, misreading an attractive conversion uplift without adequate samples, and overlooking a deterioration in safety or error rates. Ordinary dashboards can calculate rates but cannot fairly interpret whether a signed analyst report follows a locked human-defined plan. Ordinary AI can interpret narrative methods but should not be trusted to overrule arithmetic.

**LIFTWATCH combines both:**

- Preregister **hypothesis, primary metric, population and randomization** in a wallet-signed frozen plan, bound to an independent analyst address.
- Lock the signed analyst's **six aggregate counts** and methods note with SHA-256. A report is immutable and may be submitted once per trial.
- Compute four integer-only gates without trusting an LLM: minimum sample per arm; minimum absolute conversion lift; approximate **two-sided 95% pooled two-proportion z-test**; and a maximum treatment-side error-rate increase.
- Use independent AI validators to check **pre-registration coherence, randomization claims and measurement integrity**, with deterministic literal reference IDs. Invalid format and fabricated IDs fail closed to REVIEW.
- Produce `ELIGIBLE`, `HOLD` or `REVIEW`. **Even if the LLM says PASS, a failed quantitative gate forces HOLD.**
- Require an explicit owner wallet to change ELIGIBLE into `AUTHORIZED`, with exact preregistration/report SHA-256 receipts. This **does not deploy code or change production traffic**.

## End-to-end state machine

```text
OWNER:    preregister → REGISTERED
ANALYST:  submit_results → EVIDENCE_LOCKED
ANALYST:  assess_trial → ELIGIBLE | HOLD | REVIEW
OWNER:    authorize_rollout (only if ELIGIBLE) → AUTHORIZED
OWNER:    close_trial (assessed nonterminal states) → CLOSED
```

The owner and analyst **must be distinct wallets**. No retcon of thresholds after enrollment. No self-approval. No repeated reporting or assessment. If the AI cannot substantiate methodology, REVIEW remains non-authorizable.

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
| `authorize_rollout` | Product owner | Writes a **non-executing** authorization bound to both source hashes |
| `close_trial` | Product owner | Closes an assessed trial with a reason; no rollout |
| `get_trial`, `get_reference_bank`, `stats` | Anyone | Verifiable latest-final state and evidence ID mapping |

**AI model:** `gl.nondet.exec_prompt(prompt,response_format='json')`, normalized and checked again after `gl.eq_principle.prompt_comparative`. `checked_methodology` rejects incorrect citation IDs, wrong criterion fields, unsubstantiated schema and duplicate evidence references. Consensus still depends on validator interpretation; LLM rationales are not mathematical proof.

## Quick start

The `web/` dashboard contains local sample metrics, experiment preregistration, data-entry form, integer-only real-time analysis, wallet-signing actions, and contract-state verification. Before deployment it clearly displays **EXAMPLE DATA · NO CHAIN PROOF**.

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
python -m py_compile contracts/liftwatch.py
npm run build
npm run schema:studionet
```

GenLayerJS is pinned via `genlayer-stable: npm:genlayer-js@1.1.8`. Offline npm install failure is **not** equivalent to a successful build or SDK attestation.

## Example cohort (fictional)

The preregistered trial uses a persistent randomization plan, 2,500 users in each arm, a conversion goal of +150 bps, and an error-rate guardrail of +100 bps. The illustrative results are **300/2,500** conversions for control and **400/2,500** for treatment, with **22** versus **24** errors. The deterministic gates pass for this *example*. AI methodology assessment is **not** claimed without a real accepted onchain transaction; self-reported methods notes are not independent provider verification.

[**Studio acceptance guide**](docs/STUDIO_ACCEPTANCE.md) · [**Security/trust model**](docs/SECURITY_MODEL.md)

## Integrity and scope

This is an **authorization ledger**, not an actual feature deployment service, statistical consulting certification, A/B testing analytics provider, investment/trading tool, and not a live production traffic switch. Missing allocation logs, cohort timestamps, sample ratio diagnostics or multiple-testing corrections can invalidate causal interpretation despite arithmetic success. Use independent signed/provider-backed evidence in a production integration.

The current local test suite covers sample thresholds, z² arithmetic, guardrails, wallet roles, consent to release, false evidence IDs, hash mismatch, snapshot tampering and fail-closed outcomes. **Accepted multi-validator GenLayer judgments have not yet been provided.**

**License:** MIT, see [LICENSE](LICENSE).
