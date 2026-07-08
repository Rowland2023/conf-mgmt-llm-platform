// src/modules/event-schedule/index.js

// -----------------------------------------------------------------------------
// Infrastructure - Database only
// -----------------------------------------------------------------------------
import { PostgresEventRepository } from './infrastructure/repositories/PostgresEventRepository.js';
import { PostgresOutboxRepository } from './infrastructure/repositories/PostgresOutboxRepository.js';
import { UserRepository } from './infrastructure/repositories/UserRepository.js';

// -----------------------------------------------------------------------------
// Observability
// -----------------------------------------------------------------------------
import { EventLogger } from './infrastructure/observability/Logger.js';
import { EventMetrics } from './infrastructure/observability/Metrics.js';
import { EventTracing } from './infrastructure/observability/Tracing.js';

// -----------------------------------------------------------------------------
// Domain - Pure business logic
// -----------------------------------------------------------------------------
import { EventSchedulingService } from './domain/service/Eventscheduling.service.js';

// -----------------------------------------------------------------------------
// Application - Sync use cases only
// -----------------------------------------------------------------------------
import { CreateEventUseCase } from './application/use-case/create-event.usecase.js';
import { CancelEventUseCase } from './application/use-case/cancel-event.usecase.js';
import { GetEventUseCase } from './application/use-case/get-event.usecase.js';
import { ListEventsUseCase } from './application/use-case/list-event.usecase.js';
import { RescheduleEventUseCase } from './application/use-case/reschedule-event.usecase.js';

// -----------------------------------------------------------------------------
// Presentation
// -----------------------------------------------------------------------------
import { EventController } from './api/controllers/event.controller.js';
import createEventRouter from './api/routes/event.routes.js';

export function initEventModule(db, { uowFactory }) {
    // ----------------------------------------------------------------------
    // Infrastructure
    // ----------------------------------------------------------------------
    const eventRepository = new PostgresEventRepository(db);
    const outboxRepository = new PostgresOutboxRepository(db);
    const userRepository = new UserRepository(db);

    // ----------------------------------------------------------------------
    // Observability
    // ----------------------------------------------------------------------
    const logger = new EventLogger();
    const metrics = new EventMetrics();
    const tracing = new EventTracing();

    // ----------------------------------------------------------------------
    // Domain Services - No external dependencies
    // ----------------------------------------------------------------------
    const eventSchedulingService = new EventSchedulingService({
        eventRepository,
        logger
    });

    // ----------------------------------------------------------------------
    // Application Use Cases - Write to DB/Outbox only
    // ----------------------------------------------------------------------
    const createEventUseCase = new CreateEventUseCase({
        eventRepository,
        userRepository,
        outboxRepository,
        eventSchedulingService,
        uowFactory,
        logger,
        metrics
    });

    const cancelEventUseCase = new CancelEventUseCase({
        eventRepository,
        outboxRepository,
        eventSchedulingService,
        uowFactory,
        logger,
        metrics
    });

    const getEventUseCase = new GetEventUseCase({ 
        eventRepository 
    });

    const listEventsUseCase = new ListEventsUseCase({ 
        eventRepository 
    });

    const rescheduleEventUseCase = new RescheduleEventUseCase({
        eventRepository,
        outboxRepository,
        eventSchedulingService,
        uowFactory,
        logger,
        metrics
    });

    // ----------------------------------------------------------------------
    // Controller - No LLM, no Gateways
    // ----------------------------------------------------------------------
    const controller = new EventController({
        createEventUseCase,
        cancelEventUseCase,
        getEventUseCase,
        listEventsUseCase,
        rescheduleEventUseCase
    });

    // ----------------------------------------------------------------------
    // Router
    // ----------------------------------------------------------------------
    return createEventRouter(controller);
}