// src/modules/notification/index.js
// Composition root for notification module

import { PostgresNotificationRepository } from "./infrastructure/repositories/PostgresNotificationRepository.js";
import { PostgresOutboxRepository } from "./infrastructure/repositories/PostgresOutboxRepository.js";
import { EmailGateway } from "./infrastructure/gateways/EmailGateway.js";
import { SmsGateway } from "./infrastructure/gateways/SmsGateway.js";
import { PushNotificationGateway } from "./infrastructure/gateways/PushNotificationGateway.js";
import { NotificationDispatcher } from "./infrastructure/services/NotificationDispatcher.js";

import { SendNotificationUseCase } from "./application/use-cases/SendNotificationUseCase.js";
import { SendEmailUseCase } from "./application/use-cases/SendEmailUseCase.js";
import { SendSMSUseCase } from "./application/use-cases/SendSMSUseCase.js";
import { SendPushUseCase } from "./application/use-cases/SendPushUseCase.js";
import { ProcessConferenceReminderUseCase } from "./application/use-cases/ProcessConferenceReminderUseCase.js";
import { GetNotificationUseCase } from "./application/use-cases/GetNotificationUseCase.js";
import { ListNotificationUseCase } from "./application/use-cases/ListNotificationUseCase.js";
import { UpdateNotificationUseCase } from "./application/use-cases/UpdateNotificationUseCase.js";
import { DeleteNotificationUseCase } from "./application/use-cases/DeleteNotificationUseCase.js";

import { PaymentReleasedHandler } from "./application/event-handlers/PaymentReleasedHandler.js";
import { NotificationController, createNotificationRouter } from "./api/index.js";

export function createNotificationModule({
  db,
  redis,
  logger,
  config,
  eventBus
}) {
  // 1. FAIL FAST: Assert critical dependencies exist immediately
  if (!db) throw new Error("NotificationModule: 'db' is a required dependency.");
  if (!logger) throw new Error("NotificationModule: 'logger' is a required dependency.");
  if (!eventBus) throw new Error("NotificationModule: 'eventBus' is a required dependency.");
  
  const sendgridKey = config?.sendgrid?.apiKey;
  if (!sendgridKey) {
    logger.warn("NotificationModule: Sendgrid API key is missing. Email deliveries will fail.");
  }

  //
  // Infrastructure
  //
  const notificationRepository = new PostgresNotificationRepository({ db });
  const outboxRepository = new PostgresOutboxRepository({ db });
  
  const emailGateway = new EmailGateway({ 
    apiKey: sendgridKey, 
    logger 
  });
  const smsGateway = new SmsGateway({ 
    apiKey: config?.twilio?.apiKey, 
    logger 
  });
  const pushGateway = new PushNotificationGateway({ 
    firebase: config?.firebase, 
    logger 
  });
  
  const dispatcher = new NotificationDispatcher({ 
    emailGateway, 
    smsGateway, 
    pushGateway, 
    logger 
  });

  //
  // Application
  //
  const sendEmailUseCase = new SendEmailUseCase({ 
    notificationRepository, 
    dispatcher, 
    logger 
  });
  
  const sendSMSUseCase = new SendSMSUseCase({ 
    notificationRepository, 
    dispatcher, 
    logger 
  });
  
  const sendPushUseCase = new SendPushUseCase({ 
    notificationRepository, 
    dispatcher, 
    logger 
  });

  const sendNotificationUseCase = new SendNotificationUseCase({
    notificationRepository,
    dispatcher,
    logger
  });

  const processConferenceReminderUseCase = new ProcessConferenceReminderUseCase({
    notificationRepository,
    dispatcher,
    logger
  });

  const getNotificationUseCase = new GetNotificationUseCase({ notificationRepository });
  const listNotificationUseCase = new ListNotificationUseCase({ notificationRepository });
  const updateNotificationUseCase = new UpdateNotificationUseCase({ notificationRepository });
  const deleteNotificationUseCase = new DeleteNotificationUseCase({ notificationRepository });

  const paymentReleasedHandler = new PaymentReleasedHandler({
    sendEmailUseCase,
    logger
  });

  //
  // Presentation
  //
  const notificationController = new NotificationController({
    sendNotificationUseCase,
    getNotificationUseCase,
    listNotificationUseCase,
    updateNotificationUseCase,
    deleteNotificationUseCase,
    logger
  });

  const router = createNotificationRouter({ notificationController });

  // Store references to teardown event handlers later
  let subscriptionToken = null;

  return {
    router,
    
    // Subscribe with a clean wrapper instead of loose bind
    subscribe: () => {
      subscriptionToken = eventBus.subscribe('payment.released', async (event) => {
        try {
          await paymentReleasedHandler.handle(event);
        } catch (err) {
          logger.error({ err, event }, "Failed to process payment.released event");
        }
      });
    },

    // 2. LIFECYCLE: Graceful shutdown hook to prevent memory leaks and clean up gateways
    close: async () => {
      logger.info("Closing Notification Module...");
      if (subscriptionToken && typeof eventBus.unsubscribe === 'function') {
        eventBus.unsubscribe('payment.released', subscriptionToken);
      }
      // Close open clients here if any of your gateways maintain persistent sockets
    }
  };
}