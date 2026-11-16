# LIFTWATCH — signed Studionet acceptance plan

**Target network:** GenLayer Studionet, chain ID **61999**, https://studio.genlayer.com. All example data is fabricated for protocol testing and must be labeled accordingly. These are requested test steps, not recorded live transactions.

## Step 0 — deploy and verify

Upload [contracts/liftwatch.py](../contracts/liftwatch.py) into Studio; use **Normal / Full Consensus** and **Simulation OFF**. Deploy `LiftWatch()` **without constructor arguments**. Save the address and deployment hash; independently verify `LATEST_FINAL stats()` has name `LIFTWATCH`, version `1.0.0`, nonexecuting authorization and deterministic citation IDs. Compare actual RPC source/ABI to this source (only line-ending normalization allowed).

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

Verify **FINALIZED / GenVM SUCCESS / MAJORITYAGREE**, then the independent `LATEST_FINAL get_trial` readback. Three method checks must have valid reference IDs; their results can legitimately be PASS, FAIL or REVIEW. Only `ELIGIBLE` with `assessment.verdict=PASS` and `metrics.deterministic_gate=true` qualifies for the next step.

If the evaluator returns REVIEW, inspect whether the supplied note actually proves random assignment; the note is signed but **not an independently fetched assignment log**. Preserve this valid limitation rather than forcing a PASS.

## Step 4 — owner signs `authorize_rollout` only if ELIGIBLE

Read `get_trial` and verify `AUTHORIZED` and `authorization.scope=NON_EXECUTING_RELEASE_DECISION` with matching frozen `plan_sha256`, `report_sha256` and trial ID. **No external product release is performed** by the contract.

If review fails or a mathematical gate is false, an owner may call `close_trial(trial_id,reason)`; this is an honest HOLD/CLOSED path, not success.

## Negative controls, no forged proof

Wrong signer submitting results; counts outside populations; changed methods-note hash; double submission; AI review with fabricated reference ID; weak sample size; negative uplift; error guardrail violation; owner authorizing without persisted ELIGIBLE. Unit tests cover these boundaries, but user-facing signed proof requires real transactions.

Do not claim statistical significance, accepted consensus or live transaction hash from a screenshot of the static dashboard. Only accepted validator consensus plus independently read final state count.
