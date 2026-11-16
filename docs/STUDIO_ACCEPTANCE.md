# LIFTWATCH — reproducible signed Studionet acceptance

**Current verified deployment:** [LIFTWATCH V1.1 `0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106`](https://studio.genlayer.com/?import-contract=0x57B02e2a91863fAD0B7f5fdf50D4f25a46cE5106), GenLayer Studionet chain **61999**. Trial #1 completed the **signed, accepted and independently verified** `REGISTERED → EVIDENCE_LOCKED → ELIGIBLE → AUTHORIZED` path. See the four transaction links and live evidence verifier in [README](../README.md#signed-on-chain-acceptance--v11). All experiment counts are synthetic. This guide is also a reproducible test procedure, not a claim of live customer exposure.

## Step 0 — deploy and verify

Deploy [V1.1 source `contracts/liftwatch_v11.py`](../contracts/liftwatch_v11.py) as a **separate** `LiftWatch()` instance without constructor arguments; use **Normal / Full Consensus** and **Simulation OFF**. Verify `LATEST_FINAL stats()` has `version=1.1.0`, `citation_mode=CONTRACT_ASSIGNED_LITERAL_REFERENCES`, `retry_policy=FORMAT_REVIEW_ONLY`, `max_assessment_runs=3` and `rollout=NON_EXECUTING_AUTHORIZATION`. Compare deployed RPC code with the exact GitHub source (line-ending normalization only). The verified live release address is above; do not redeploy unless conducting an explicitly separate experiment.

Use **two distinct wallets**: product **owner** (first Studio account) and **analyst** (second Studio account). Each must sign the corresponding method; wrong-wallet attempts must fail. Copy the **analyst** wallet address for preregistration.

## Step 1 — owner signs `preregister`

Parameters, in exact function order:

| Parameter | Example value |
| --- | --- |
| `title` | `Checkout A/B protection` |
| `hypothesis` | `A more legible checkout step should increase completed checkout conversion from eligible sessions.` |
| `metric_definition` | `Primary endpoint: unique completed checkouts per eligible unique visitor, measured in the same attribution window.` |
| `population` | `New and returning visitors randomly assigned by persistent stable user ID during the frozen fortnight.` |
| `randomization` | `Stable user-ID hashing into mutually exclusive 50/50 groups before first checkout exposure; no manual reassignment or crossover.` |
| `analyst_address` | **Actual different Studionet wallet address** |
| `min_arm` | `500` |
| `min_lift_bps` | `150` |
| `max_error_increase_bps` | `100` |

Read `get_trial(actual_id)` after **Accepted** transaction; verify `REGISTERED`, both wallets, `plan_sha256` and the 3 frozen methodology fields. Use the actual returned ID, never assume 1 unless the contract is new.

## Step 2 — analyst signs `submit_results`

Parameters:

| Parameter | Exact value |
| --- | --- |
| `trial_id` | Actual ID |
| `control_users` | `2500` |
| `control_success` | `300` |
| `treatment_users` | `2500` |
| `treatment_success` | `400` |
| `control_errors` | `22` |
| `treatment_errors` | `24` |
| `methods_note` | See exact note below |
| `methods_sha256` | SHA-256 below, only for exact note text |

```text
Experiment assignment used a persistent user-ID hash with a frozen 50/50 split. All eligible visitors were counted once during the same two-week window; the primary event was completed checkout. Errors were tracked consistently in both arms and no eligibility rule was changed after preregistration.
```

For the exact single line above without enclosing fence newline:
```text
1e9459ae5a080319298502c90f3e178b4ac3cd9c7c0a48e79521a5503b8385b4
```

Read `get_trial(trial_id)`, inspect `EVIDENCE_LOCKED`, committed report SHA-256, four deterministic gates and calculation. **No AI verdict yet.**

## Step 3 — same analyst signs `assess_trial`

Verify **FINALIZED / GenVM SUCCESS / MAJORITYAGREE** and independent `LATEST_FINAL get_trial` readback. The contract itself attaches literal reference IDs from frozen data to exactly three methodology decisions. They can legitimately be PASS, FAIL or REVIEW. Only stored `ELIGIBLE`, `assessment.verdict=PASS`, three verifiable citations and `metrics.deterministic_gate=true` qualify for authorization. If the on-chain verdict is technical `REVIEW` with `format_fallback=true`, the **same Analyst** may call `retry_format_review(trial_id)` while fewer than three total attempts have been recorded; do not retry substantive REVIEW or mathematical HOLD.

An accepted PASS confirms internal consistency of signed notes, **not independent verification** of random assignment, conversion logs or causality. Preserve any valid substantive REVIEW rather than forcing PASS.

## Step 4 — owner signs `authorize_rollout` only if ELIGIBLE

Read `get_trial` and verify `AUTHORIZED` and `authorization.scope=NON_EXECUTING_RELEASE_DECISION` with matching frozen `plan_sha256`, `report_sha256` and trial ID. **No external product release is performed** by the contract.

If review fails or a mathematical gate is false, an owner may call `close_trial(trial_id,reason)`; this is an honest HOLD/CLOSED path, not success.

## Negative controls, no forged proof

Wrong signer submitting results; counts outside populations; changed methods-note hash; double submission; AI review with fabricated reference ID; weak sample size; negative uplift; error guardrail violation; owner authorizing without persisted ELIGIBLE. Unit tests cover these boundaries, but user-facing signed proof requires real transactions.

Do not claim statistical significance, accepted consensus or live transaction hash from a screenshot of the static dashboard. Only accepted validator consensus plus independently read final state count.
