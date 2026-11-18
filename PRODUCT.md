# Product

## Positioning

Ripple is a visual what-if explorer and **experimental decision-rehearsal tool**. Map how a change might spread, inspect assumptions and simulated actions, and compare alternatives. It is not a calibrated prediction engine.

## Modes

- **Quick Ripple:** the existing Gemma-powered or offline-demo possibility graph, with validated streams and a whimsical pixel world.
- **Simulation (experimental):** a local-only pricing decision lab with source review, bounded customer-segment agents, persistent event logs, comparisons, checkpoints and reports.

## First supported use case

Subscription pricing and staged rollout. A user supplies a current price, segment counts and historical churn, then considers two alternatives. Ripple derives illustrative fixed-churn calculations and explores how bounded simulated actors may respond. Synthetic agents are not customers, and their agreement is not a probability.

## Users

People preparing product or operational decisions who need to identify affected parties, possible mechanisms, evidence gaps and failure paths before taking real action.

## Design commitments

Keep the original pixel handwriting, sprites, doodles, colors and playful microcopy. Maintain the World / Journal / Compare interface and Quick Ripple workflow. Add new UI that feels native; do not replace the design with a generic SaaS dashboard.

## Trust

1. Distinguish observed sources, user assumptions, derived calculations, agent beliefs, hypotheses and simulated events.
2. Validate actions through a deterministic reducer; model text must not directly mutate world state.
3. Never present synthetic response counts as real-world probabilities.
4. Keep source files private locally, make event logs inspectable, checkpoint round transitions and allow bounded recovery.
5. Validate against historical outcomes and user studies before claiming forecasting value.

## Deployment status

Public Vercel and Docker deployments serve Quick Ripple. Simulation projects and workers are local-only. Hosted authentication, PostgreSQL, separate worker deployment, private object storage and reliable cross-tenant quotas are not implemented.

## Release gates

Unit, build, browser and synthetic replay integrity tests must pass. Historical calibration, real-user usefulness studies and production privacy/reliability audits remain pending before v1.0.
