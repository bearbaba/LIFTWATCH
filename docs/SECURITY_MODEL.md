# LIFTWATCH — trust boundaries and threat model

The highest-risk failure is a false rollout authorization based on incorrect, selectively reported or self-serving experiment evidence.

## Deterministic non-bypassable gates

- Owner preregisters **immutable** hypothesis, population, metric, randomization and thresholds. Analyst must be another wallet.
- Analyst can submit **one** signed report with all six aggregate counts and a hashed methodological note; neither user role may revise it afterward.
- Numeric inputs are bounded integers; conversions/errors cannot exceed an arm's participant population.
- Both arms must satisfy `min_arm`. Conversion uplift must clear `min_lift_bps`. A two-sided 95% pooled z approximation (with 5 expected successes and failures per arm) must be passed and the treatment error-rate increase must stay within `max_error_increase_bps`.
- If any deterministic condition fails, even a complete AI PASS is **HOLD**, never ELIGIBLE.
- The LLM is constrained to three methodology dimensions with IDs from a deterministic reference bank; invalid/forged IDs become **REVIEW**. Comparative validators assess substance as well as formatting.
- Only the owner can explicitly write the non-executing authorization, after a stored ELIGIBLE judgment and exact plan/report SHA-256 matching.

## Disclosed limitations — important

Statistical significance is *not* causality. The z test is an approximation under assumptions; independent randomization, no interference, stable attribution, sample ratio, experiment duration, peeking, power, sequential design and correction for multiple comparisons are **not programmatically proven** by six reported counts. The analyst methods note is signed but can be untrue. The GenLayer model interprets this note under stated methodology; without external provider-backed logs, REVIEW may be the correct result. `AUTHORIZED` is a decision receipt, **not a production deployment, token transfer or payment**.

No oracle makes external analytics automatically trustworthy. Production integrations should use reproducible data exports with source commitments and authorization/revocation controls; audit independent assignments and sampling.

## Failure-path demonstrations

Unit tests explicitly cover negative lift, insufficient samples, non-significant apparent uplift, unsafe error rates, unsigned/changed notes, fake reference IDs, stale/changed data, multiple submissions, wrong signer, and unauthorized finalization. Signed Studio tests may be added after authentic deployment; do not manufacture consensus traces.
