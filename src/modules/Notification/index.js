// src/modules/notification/index.js

// Database
import knex from "../../src/Shared/infrastructure/database/knex.js";

// Repositories
import { PostgresNotificationRepository } from "./infrastructure/repositories/PostgresNotificationRepository.js";
import { PostgresOutboxRepository } from "./infrastructure/repositories/PostgresOutboxRepository.js";

// Gateways
import { EmailGateway } from "./infrastructure/gateways/EmailGateway.js";
import { SmsGateway } from "./infrastructure/gateways/SmsGateway.js";
import { PushNotificationGateway } from "./infrastructure/gateways/PushNotificationGateway.js";

// Infrastructure Services
import { NotificationDispatcher } from "./infrastructure/services/NotificationDispatcher.js";

// Application
// Application Use Cases
import { SendNotificationUseCase } from "./application/use-cases/SendNotificationUseCase.js";
import { SendEmailUseCase } from "./application/use-cases/SendEmailUseCase.js";
import { SendSMSUseCase } from "./application/use-cases/SendSMSUseCase.js";
import { SendPushUseCase } from "./application/use-cases/SendPushUseCase.js";
import { ProcessConferenceReminderUseCase } from "./application/use-cases/ProcessConferenceReminderUseCase.js";
import { GetNotificationUseCase } from "./application/use-cases/GetNotificationUseCase.js";
import { ListNotificationUseCase } from "./application/use-cases/ListNotificationUseCase.js";
import { UpdateNotificationUseCase } from "./application/use-cases/UpdateNotificationUseCase.js";
import { DeleteNotificationUseCase } from "./application/use-cases/DeleteNotificationUseCase.js";

// Presentation
import { NotificationController } from "./api/notification.controller.js";
import { createNotificationRouter } from "./api/notification.route.js";