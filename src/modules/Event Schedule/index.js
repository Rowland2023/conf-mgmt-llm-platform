// src/modules/schedule/index.js
import { UnitOfWork } from "../../shared/infrastructure/UnitOfWork.js";
import { PostgresEventRepository } from "./infrastructure/repositories/PostgresEventRepository.js";
import { PostgresOutboxRepository } from "./infrastructure/repositories/PostgresOutboxRepository.js";
import { GoogleCalendarGateway } from "./infrastructure/gateways/GoogleCalendarGateway.js";
import { OutlookCalendarGateway } from "./infrastructure/gateways/OutlookCalendarGateway.js";
import { ZoomGateway } from "./infrastructure/gateways/ZoomGateway.js";
import { CalendarSynchronizationService } from "./infrastructure/services/CalendarSynchronizationService.js";
import { OutboxWorker } from "./infrastructure/workers/OutboxWorker.js";
import { EventSchedulingService } from "./domain/services/EventSchedulingService.js";
import { CreateEventUseCase } from "./application/use-cases/CreateEventUseCase.js";
import { UpdateEventUseCase } from "./application/use-cases/UpdateEventUseCase.js";
import { DeleteEventUseCase } from "./application/use-cases/DeleteEventUseCase.js";
import { GetEventUseCase } from "./application/use-cases/GetEventUseCase.js";
import { ListEventsUseCase } from "./application/use-cases/ListEventsUseCase.js";
import { RescheduleEventUseCase } from "./application/use-cases/RescheduleEventUseCase.js";
import { CancelEventUseCase } from "./application/use-cases/CancelEventUseCase.js";
import { EventController, createEventRouter } from "./api/index.js";

export function createEventModule({ dbConnection, logger, config }) {
  // 1. Fail fast
  if (!dbConnection) throw new Error("Event Module: dbConnection is required.");
  if (!logger) throw new Error("Event Module: logger is required.");
  if (!config) throw new Error("Event Module: config is required.");

  // 2. UnitOfWork - single source of truth for transactions
  const uow = new UnitOfWork(dbConnection);
  
  // 3. Repositories - ONLY receive uow, not raw dbConnection
  const eventRepository = new PostgresEventRepository({ uow });
  const outboxRepository = new PostgresOutboxRepository({ uow });

  // 4. Gateways
  const googleCalendarGateway = new GoogleCalendarGateway({
    clientId: config?.google?.clientId,
    clientSecret: config?.google?.clientSecret,
    logger
  });
  const outlookCalendarGateway = new OutlookCalendarGateway({
    clientId: config?.microsoft?.clientId,
    clientSecret: config?.microsoft?.clientSecret,
    logger
  });
  const zoomGateway = new ZoomGateway({
    apiKey: config?.zoom?.apiKey,
    apiSecret: config?.zoom?.apiSecret,
    logger
  });

  // 5. Infrastructure Services
  const calendarSynchronizationService = new CalendarSynchronizationService({
    googleCalendarGateway,
    outlookCalendarGateway,
    zoomGateway,
    logger
  });

  // 6. Domain Services
  const eventSchedulingService = new EventSchedulingService({ eventRepository });

  // 7. Use Cases - all get uow for transactional outbox
  const createEventUseCase = new CreateEventUseCase({
    eventRepository, outboxRepository, eventSchedulingService, uow, logger
  });
  const updateEventUseCase = new UpdateEventUseCase({
    eventRepository, outboxRepository, eventSchedulingService, uow, logger
  });
  const deleteEventUseCase = new DeleteEventUseCase({
    eventRepository, outboxRepository, uow, logger
  });
  const rescheduleEventUseCase = new RescheduleEventUseCase({
    eventRepository, outboxRepository, eventSchedulingService, uow, logger
  });
  const cancelEventUseCase = new CancelEventUseCase({
    eventRepository, outboxRepository, eventSchedulingService, uow, logger
  });
  const getEventUseCase = new GetEventUseCase({ eventRepository, logger });
  const listEventsUseCase = new ListEventsUseCase({ eventRepository, logger });

  // 8. Background Workers
  const outboxWorker = new OutboxWorker({
    outboxRepository,
    calendarSynchronizationService,
    logger
  });

  // 9. Presentation
  const eventController = new EventController({
    createEventUseCase,
    updateEventUseCase,
    deleteEventUseCase,
    getEventUseCase,
    listEventsUseCase,
    rescheduleEventUseCase,
    cancelEventUseCase
  });

  const eventRouter = createEventRouter({ eventController });

  // 10. Module API
  return {
    eventRouter,
    
    subscribe: (eventBus) => {
      eventBus.subscribe('payment.released', async (evt) => {
        await createEventUseCase.execute({
          title: `Escrow Released: ${evt.paymentId}`,
          startTime: evt.releasedAt,
          type: 'SYSTEM',
          correlationId: evt.correlationId
        });
      });
    },
    
    start: async () => {
      logger.info('Starting Event module workers...');
      await outboxWorker.start();
    },
    stop: async () => {
      logger.info('Stopping Event module workers...');
      await outboxWorker.stop();
    }
  };
}