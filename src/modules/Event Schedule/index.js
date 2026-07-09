// -----------------------------------------------------------------------------
// Infrastructure Layer: Data Repositories
// -----------------------------------------------------------------------------
import { PostgresEventRepository } from "./infrastructure/repositories/PostgresEventRepository.js";
import { PostgresOutboxRepository } from "./infrastructure/repositories/PostgresOutboxRepository.js";

// -----------------------------------------------------------------------------
// Infrastructure Layer: Network Gateways
// -----------------------------------------------------------------------------
import { GoogleCalendarGateway } from "./infrastructure/gateways/GoogleCalendarGateway.js";
import { OutlookCalendarGateway } from "./infrastructure/gateways/OutlookCalendarGateway.js";
import { ZoomGateway } from "./infrastructure/gateways/ZoomGateway.js";

// -----------------------------------------------------------------------------
// Infrastructure Layer: Core Anti-Corruption & Synchronization Services
// -----------------------------------------------------------------------------
import { CalendarSynchronizationService } from "./infrastructure/services/CalendarSynchronizationService.js";

// -----------------------------------------------------------------------------
// Infrastructure Layer: Background Engine Daemons
// -----------------------------------------------------------------------------
import { OutboxWorker } from "./infrastructure/workers/OutboxWorker.js";

// -----------------------------------------------------------------------------
// Domain Layer: Pure Business Rule Services
// -----------------------------------------------------------------------------
import { EventSchedulingService } from "./domain/services/EventSchedulingService.js";

// -----------------------------------------------------------------------------
// Application Layer: Orchestration Use Cases
// -----------------------------------------------------------------------------
import { CreateEventUseCase } from "./application/use-cases/CreateEventUseCase.js";
import { UpdateEventUseCase } from "./application/use-cases/UpdateEventUseCase.js";
import { DeleteEventUseCase } from "./application/use-cases/DeleteEventUseCase.js";
import { GetEventUseCase } from "./application/use-cases/GetEventUseCase.js";
import { ListEventsUseCase } from "./application/use-cases/ListEventsUseCase.js";
import { RescheduleEventUseCase } from "./application/use-cases/RescheduleEventUseCase.js";
import { CancelEventUseCase } from "./application/use-cases/CancelEventUseCase.js";

// -----------------------------------------------------------------------------
// Presentation Layer: HTTP Transport Surface API
// -----------------------------------------------------------------------------
import { EventController } from "./api/event.controller.js";
import { createEventRouter } from "./api/event.route.js";

/**
 * Module Initializer Matrix (Bottom-Up Assembly Factory)
 * 
 * Isolates the module from global database instances by accepting database connections 
 * explicitly from the application bootstrapper.
 * 
 * @param {Object} config
 * @param {Object} config.dbConnection - Instantiated Knex connection instance or equivalent query builder client
 * @returns {Object} Exported module runtime contract surfaces
 */
export function initializeEventScheduleModule({ dbConnection }) {
    if (!dbConnection) {
        throw new Error("EventSchedule Module Factory Failure: An active dbConnection instance is required.");
    }

    // 1. Core Base Data Storage Engines
    const eventRepository = new PostgresEventRepository(dbConnection);
    const outboxRepository = new PostgresOutboxRepository(dbConnection);

    // 2. High-Level Network Client Gateways
    const googleCalendarGateway = new GoogleCalendarGateway();
    const outlookCalendarGateway = new OutlookCalendarGateway();
    const zoomGateway = new ZoomGateway();

    // 3. Infrastructure Coordination Facades
    const calendarSynchronizationService = new CalendarSynchronizationService({
        googleCalendarGateway,
        outlookCalendarGateway,
        zoomGateway
    });

    // 4. Pure Domain Coordination Services
    const eventSchedulingService = new EventSchedulingService({
        eventRepository
    });

    // 5. Application Single-Intent Use Cases
    const createEventUseCase = new CreateEventUseCase({
        eventRepository,
        outboxRepository,
        eventSchedulingService
    });

    const updateEventUseCase = new UpdateEventUseCase({
        eventRepository,
        outboxRepository,
        eventSchedulingService
    });

    const deleteEventUseCase = new DeleteEventUseCase({
        eventRepository,
        outboxRepository
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
        eventSchedulingService
    });

    const cancelEventUseCase = new CancelEventUseCase({
        eventRepository,
        outboxRepository,
        eventSchedulingService
    });

    // 6. Asynchronous Background Daemon Loop Workers
    const outboxWorker = new OutboxWorker({
        outboxRepository,
        calendarSynchronizationService
    });

    // 7. HTTP Network Input Controllers
    const eventController = new EventController({
        createEventUseCase,
        updateEventUseCase,
        deleteEventUseCase,
        getEventUseCase,
        listEventsUseCase,
        rescheduleEventUseCase,
        cancelEventUseCase
    });

    // 8. Core Router Interface Mapping
    const eventRouter = createEventRouter({
        eventController
    });

    // 9. Lifecycle Control Hooks Interface Surface
    return {
        eventRouter,
        
        /**
         * Safely starts background workers, listeners, and loops.
         */
        async start() {
            if (outboxWorker && typeof outboxWorker.start === "function") {
                await outboxWorker.start();
            }
        },

        /**
         * Safely shuts down background routines during graceful service teardowns.
         */
        async stop() {
            if (outboxWorker && typeof outboxWorker.stop === "function") {
                await outboxWorker.stop();
            }
        },

        // Exported infrastructure adapters for testing or multi-module composition needs
        eventRepository,
        outboxRepository,
        eventSchedulingService,
        calendarSynchronizationService,

        // Exported use-case boundaries
        useCases: {
            createEventUseCase,
            updateEventUseCase,
            deleteEventUseCase,
            getEventUseCase,
            listEventsUseCase,
            rescheduleEventUseCase,
            cancelEventUseCase
        }
    };
}