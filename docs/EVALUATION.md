# Ripple simulation evaluation

Run `npm run evaluate`. The current fixtures are **synthetic tests**, not empirical forecasts or held-out historical cases.

The evaluation checks deterministic event replay, state hashes, evidence references, intervention sensitivity, and whether rule-based agents actually react to an announced intervention. It compares baseline and changed-price runs with the same seed.

This does **not** prove that synthetic customer behavior matches real customers. It does not measure forecast calibration, stakeholder realism, or advantage over a human's one-shot analysis. Those release gates require collected, permissioned historical cases with known outcomes and independent user studies.

Before claiming a production v1 release:

- Collect appropriate real pricing decisions with dated input snapshots and known outcomes, separated from development fixtures.
- Document the simpler no-agent baseline and ask evaluators to blind-score decision usefulness.
- Measure where evidence is missing or conflicting, not just generated graph size.
- Validate observed outcomes separately from synthetic reactions. Do not convert simulation frequency into probabilities.
