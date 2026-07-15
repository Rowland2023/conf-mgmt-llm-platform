# Conference Management System API

A production-ready, Domain-Driven Design (DDD) conference management platform built with **Node.js**, **Express.js**, **PostgreSQL**, and **Sequelize**. The system is designed around modular architecture, event-driven principles, and enterprise patterns including **Transactional Outbox**, **Optimistic Concurrency Control**, and **CQRS-inspired application services**.

---

# Features

* Domain-Driven Design (DDD)
* Modular Architecture
* RESTful API
* PostgreSQL Persistence
* Sequelize ORM
* Transactional Outbox Pattern
* Domain Events
* Optimistic Concurrency Control
* Repository Pattern
* Data Mapper Pattern
* Value Objects
* Aggregate Roots
* Event-Driven Architecture
* Dependency Injection
* Redis Support (optional)
* Kafka/RabbitMQ Ready
* JWT Authentication
* Role-Based Authorization
* Soft Delete Support
* Validation
* Structured Error Handling
* Audit-Friendly Architecture

---

# Architecture

```
src/
├── config/
├── modules/
│   ├── authentication/
│   ├── conference/
│   ├── registration/
│   ├── ticket/
│   ├── payment/
│   ├── notification/
│   └── user/
│
├── shared/
│   ├── application/
│   ├── domain/
│   ├── infrastructure/
│   └── interfaces/
│
├── routes/
├── middleware/
└── app.js
```

Each module is autonomous and contains its own:

* Domain
* Application
* Infrastructure
* Presentation

This minimizes coupling while maximizing maintainability and scalability.

---

# Technology Stack

## Backend

* Node.js
* Express.js
* JavaScript (ES Modules)

## Database

* PostgreSQL
* Sequelize ORM

## Infrastructure

* Redis
* Kafka / RabbitMQ (via Transactional Outbox)
* Docker
* Docker Compose

## Authentication

* JWT
* Refresh Tokens

---

# Domain-Driven Design

Each module follows a layered DDD architecture.

```
Module
│
├── application/
│   ├── commands/
│   ├── queries/
│   └── useCases/
│
├── domain/
│   ├── entities/
│   ├── events/
│   ├── valueObjects/
│   ├── repositories/
│   └── services/
│
├── infrastructure/
│   ├── persistence/
│   │   ├── models/
│   │   ├── mappers/
│   │   └── repositories/
│   └── integrations/
│
└── presentation/
    ├── controllers/
    ├── routes/
    └── dto/
```

---

# Domain Events

Business state changes are represented as immutable domain events.

Examples include:

* TicketCreated
* TicketReserved
* TicketReleased
* TicketPurchased
* TicketCancelled
* TicketExpired
* PaymentInitialized
* PaymentSucceeded
* RegistrationCreated

Each event inherits from the shared `DomainEvent` base class, providing:

* Event ID
* Aggregate ID
* Event Name
* Event Version
* Correlation ID
* Causation ID
* Timestamp
* Immutable Payload

---

# Transactional Outbox Pattern

The system guarantees reliable event publishing by persisting domain events and aggregate state within the same database transaction.

```
HTTP Request
      │
      ▼
Controller
      │
      ▼
Application Use Case
      │
      ▼
Aggregate
      │
      ├── Validate Business Rules
      ├── Change State
      └── Record Domain Event
      │
      ▼
Repository
      │
      ├── Save Aggregate
      ├── Save Outbox Events
      └── Commit Transaction
      │
      ▼
Outbox Publisher
      │
      ▼
Kafka / RabbitMQ
```

This approach prevents lost events while ensuring consistency between the database and message broker.

---

# Optimistic Concurrency

Aggregates use optimistic concurrency control through a version column.

Typical update:

```
UPDATE tickets
SET reserved = ?, version = version + 1
WHERE id = ?
AND version = ?;
```

This prevents concurrent updates from overwriting one another.

---

# Repository Pattern

Repositories encapsulate persistence logic.

Responsibilities include:

* Loading aggregates
* Saving aggregates
* Persisting domain events to the outbox
* Transaction management
* Optimistic concurrency enforcement

Repositories do **not** contain business rules.

---

# Data Mapper Pattern

Data mappers translate between persistence models and domain models.

```
Database
      │
      ▼
Mapper
      │
      ▼
Aggregate
```

This keeps domain entities independent of the ORM.

---

# Aggregate Lifecycle

```
Command
      │
      ▼
Use Case
      │
      ▼
Repository
      │
      ▼
Aggregate
      │
      ├── Validate
      ├── Change State
      └── Record Events
      │
      ▼
Repository.save()
      │
      ├── Persist Aggregate
      ├── Persist Outbox
      └── Commit
```

---

# Project Principles

* Domain first
* Rich domain model
* Persistence ignorance
* Explicit dependencies
* Immutable domain events
* Single Responsibility Principle
* Dependency Injection
* High cohesion
* Low coupling

---

# Running the Project

## Install dependencies

```bash
npm install
```

## Configure environment

Create an `.env` file:

```env
PORT=3000

DATABASE_URL=postgres://user:password@localhost:5432/conference

JWT_SECRET=your-secret

REDIS_URL=redis://localhost:6379
```

## Run database migrations

```bash
npm run migrate
```

## Start development server

```bash
npm run dev
```

## Run tests

```bash
npm test
```

---

# Future Enhancements

* Event Sourcing
* CQRS Read Models
* Saga Orchestration
* Elasticsearch
* Distributed Tracing
* OpenTelemetry
* Kubernetes Deployment
* Multi-tenancy
* Metrics & Observability
* API Versioning
* GraphQL Gateway

---

# License

This project is licensed under the MIT License.

---

# Author

**Rowland Obi**

Senior Backend Engineer specializing in:

* Domain-Driven Design
* Distributed Systems
* Payment Infrastructure
* Event-Driven Architecture
* PostgreSQL
* Kafka
* Redis
* Node.js
* Cloud-Native Backend Systems
