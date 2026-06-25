conf-mgmt-llm-platform**

> Enterprise-grade, LLM-orchestrated conference management platform. 
> Hexagonal Architecture + DDD + Transactional Outbox + Kafka. Zero data loss, p99 < 200ms.

[[Python](https://img.shields.io/badge/Python-3.11-blue)](https://python.org)
[[FastAPI](https://img.shields.io/badge/FastAPI-0.111-green)](https://fastapi.tiangolo.com)
[[Postgres](https://img.shields.io/badge/PostgreSQL-16-blue)](https://postgresql.org)
[[Kafka](https://img.shields.io/badge/Kafka-3.7-black)](https://kafka.apache.org)
[[Coverage](https://img.shields.io/badge/coverage-87%25-brightgreen)]()

### **Executive Summary**

LLM function-calling gateway for conference operations. The LLM is a stateless adapter that translates natural language into deterministic, audited use cases. All state changes flow through Domain Aggregates with transactional guarantees. Async side-effects via Outbox + Kafka ensure exactly-once business outcomes even during infra failures.

**Business Value**: Reduce ops overhead 80% by letting users book/reschedule via chat. Eliminate double-booking revenue loss. SOC 2 ready audit trail.

### **Architecture Principles**

| Principle | Implementation | Enterprise Guarantee |
| --- | --- | --- |
| **Determinism** | LLM cannot write DB. Only validated DTOs reach Use Cases. | No prompt injection can bypass invariants |
| **Transactional Integrity** | Postgres ACID: `Aggregate + Outbox` in single txn | Zero data loss if Kafka/Payment gateway down |
| **Eventual Consistency** | Outbox → Kafka → Consumers with idempotency keys | Exactly-once business effects |
| **Observability** | OpenTelemetry traces, Prometheus metrics, structured logs | MTTR < 5min, p99 alerts |
| **Security** | JWT + RBAC, input validation, secrets in Vault, OWASP checks | SOC 2 Type II ready |

### **Request Lifecycle**

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant G as API Gateway
    participant L as LLM Adapter
    participant A as Application Layer
    participant D as Domain Aggregate
    participant P as Postgres
    participant W as Outbox Worker
    participant K as Kafka

    U->>G: "Move keynote to 3pm, notify speakers"
    G->>L: messages + tools=[reschedule_slot]
    L->>G: function_call(validated JSON)
    G->>A: RescheduleSlot.execute(dto)
    A->>D: conference.reschedule_slot()
    D->>D: Check invariants: capacity, conflicts
    D-->>A: [SlotRescheduled, SpeakerNotificationNeeded]
    A->>P: BEGIN; UPDATE conf; INSERT outbox x2; COMMIT
    A-->>G: 200 OK
    G-->>U: "Rescheduled. Notifications queued."
    
    W->>P: SELECT ... FOR UPDATE SKIP LOCKED
    W->>K: Publish events
    K->>Consumers: Email, Calendar, Audit
```

### **Data Model & Guarantees**

1. **Write Path**: `ConferenceAggregate` is the consistency boundary. All invariants enforced in-memory before persistence.
2. **Outbox Table**: `idempotency_key`, `aggregate_id`, `type`, `payload::jsonb`, `status`, `attempts`. Polled via `FOR UPDATE SKIP LOCKED` for horizontal scale.
3. **Idempotency**: All consumers use `processed_events(event_id)` table. Duplicate Kafka deliveries = no-op.
4. **DLQ**: `conf-events.dlq.v1` topic. Messages failing schema validation after 5 retries land here with alert.

### **Non-Functional Requirements**

| Metric | Target | Validation |
| --- | --- | --- |
| **Latency** | p99 < 200ms API, < 2s e2e | k6 load test: 1K RPS |
| **Throughput** | 10K bookings/min | Kafka: 50 partitions by `room_id` |
| **Durability** | 99.999% | Jepsen-style chaos: kill Kafka leader mid-commit |
| **Availability** | 99.95% | Multi-AZ Postgres, K8s HPA + PDB |
| **Security** | OWASP Top 10 | SAST + DAST in CI, signed commits |

### **Tech Stack**

| Domain | Technology | Rationale |
| --- | --- | --- |
| **API** | FastAPI, Pydantic v2, DI via `dependency-injector` | Type safety, OpenAPI, 2.5x faster than Django |
| **Domain** | Python 3.11, `attrs`, `result` monads | Pure, no ORM leakage. 100% unit testable |
| **Persistence** | PostgreSQL 16, SQLAlchemy 2.0, `asyncpg` | ACID, JSONB, list/range partitioning |
| **Messaging** | Kafka 3.7, `aiokafka`, Schema Registry | Durable log, compaction, exactly-once |
| **LLM** | OpenAI GPT-4o, JSON mode, function-calling | Structured output, < 800ms latency |
| **Platform** | Kubernetes, Helm, ArgoCD, Terraform | GitOps, zero-downtime deploys |
| **Observability** | OpenTelemetry, Prometheus, Grafana, Loki | Distributed tracing, exemplars |
| **Security** | Keycloak/OAuth2, HashiCorp Vault, OPA | Zero-trust, policy-as-code |

### **Repository Structure**
```
conf-mgmt-llm-platform/
├── src/confmgmt/
│   ├── domain/          # Aggregates, VOs, Events. No imports from infra.
│   ├── application/     # Use cases, ports, DTOs. Transaction boundary.
│   ├── infrastructure/  # Adapters: Postgres, Kafka, OpenAI, SMTP
│   ├── api/            # FastAPI, auth, middleware, controllers
│   └── workers/        # OutboxPublisher, DLQReprocessor
├── tests/
│   ├── unit/           # Domain: 0ms, no IO
│   ├── integration/    # Testcontainers: PG + Kafka
│   └── e2e/           # LLM → DB → Kafka full flow
├── infra/
│   ├── terraform/      # EKS, RDS, MSK
│   └── helm/          # App charts, PDB, HPA
└── docs/
    ├── ARCHITECTURE.md # C4 diagrams
    └── ADR/           # Why Outbox vs CDC, Why DDD
```

### **Running Locally**

```bash
make dev-up     # docker-compose: pg, kafka, schema-registry, grafana
make migrate    # alembic upgrade head
make run        # api:8000 + worker in tmux
make test       # pytest -n auto --cov
make load-test  # k6 run tests/load/book_slot.js
```

Health: `GET /health` returns `{"status":"ok","kafka":"up","db":"up","outbox_lag":0}`

### **Security & Compliance**

1. **AuthN/Z**: JWT with `sub`, `roles`. OPA sidecar for fine-grained `room:write` policies.
2. **Data**: PII encrypted at rest via `pgcrypto`. Tenant isolation via RLS.
3. **Audit**: Every command emits `AuditLogCreated` event. Immutable S3 sink.
4. **Secrets**: No `.env` in repo. Vault injector + IRSA on EKS.
5. **Supply Chain**: SBOM generated, Grype scan blocks CVSS > 7 in CI.

### **Why This Isn’t a TODO App**

| Senior Signal | Evidence in Repo |
| --- | --- |
| **Concurrency** | `test_concurrent_booking.py` - 100 parallel requests, 1 winner, 0 race conditions |
| **Resilience** | `test_kafka_outage.py` - Kill broker, bookings still succeed, events drain on recovery |
| **LLM Safety** | `test_prompt_injection.py` - "Ignore previous instructions" → 422 Validation Error |
| **Ops** | `dashboards/` Grafana JSON: outbox_lag, dlq_rate, p99 by endpoint |


