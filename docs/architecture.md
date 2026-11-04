# Architecture notes

Decisions are logged here as short ADRs (Architecture Decision Records).

## ADR-001: Event-driven core on Kafka
- **Decision:** Every card transaction is published to a `transactions` topic. Fraud, ledger and notification services consume independently.
- **Why:** Services scale and fail on their own; replaying a topic rebuilds state.
- **Trade-off:** Eventual consistency between the ledger and the alerts view.
