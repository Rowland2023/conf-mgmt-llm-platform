// src/app.js

import express from "express";
import { db } from "./Shared/infrastructure/database/knex.js";

// Global Shared Infrastructure Engine Components
import * as messaging from "./Shared/infrastructure/messaging/index.js";
import { initLLM } from "./Shared/infrastructure/llm/index.js";

// Feature Modules
import { initEventModule } from "./modules/Event Schedule/index.js";
import { initPaymentModule } from "./modules/Payment/index.js";
import { initNotificationModule } from "./modules/Notification/index.js";
import { initRegistrationModule } from "./modules/Registration/index.js";

// Security & API Transports
import { LLMController } from "./api/llm.controller.js";
import { createLLMRouter } from "./api/llm.route.js";
import { authService } from "./Shared/security/authService.js";

const app = express();
app.use(express.json());

// =============================================================================
// 1. INITIALIZE GLOBAL INFRASTRUCTURE CORES
// =============================================================================

// Generic Outbox Publisher leveraging the global messaging client instance
const outboxPublisher = messaging.createOutboxPublisher({ 
    db, 
});

// =============================================================================
// 2. INITIALIZE FEATURE MODULES (Injecting Shared Connections)
// =============================================================================
// We pass the global messageClient down so modules can register their own events
const eventModule = initEventModule({ db, messageClient });
const paymentModule = initPaymentModule({ db, messageClient });
const notificationModule = initNotificationModule({ db, messageClient });
const registrationModule = initRegistrationModule({ db, messageClient });

// =============================================================================
// 3. INITIALIZE COGNITIVE ASSISTANT CORE (LLM Tool Mapping)
// =============================================================================
const llm = initLLM({
    openAIConfig: { apiKey: process.env.OPENAI_API_KEY },
    uowFactory: db.unitOfWorkFactory,
    useCases: {
        ...eventModule.useCases,
        ...paymentModule.useCases,
        ...registrationModule.useCases,
        ...notificationModule.useCases
    }
});

const llmController = new LLMController({ commandInterceptor: llm.commandInterceptor, authService });
const llmRouter = createLLMRouter({ llmController, authenticate: authService.authenticate });

// =============================================================================
// 4. ROUTE NETWORK MOUNT POINTS
// =============================================================================
app.use("/api/events", eventModule.router);
app.use("/api/payments", paymentModule.router);
app.use("/api/notifications", notificationModule.router);
app.use("/api/registrations", registrationModule.router);
app.use("/api/ai", llmRouter);

app.get("/", (req, res) => res.json({ status: "ok", service: "conference-core", version: "1.0.0" }));

// Fallback Error Routing Boundaries
app.use((req, res) => res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Resource not found." } }));
app.use((err, req, res, next) => {
    console.error("Critical Inbound Error:", err);
    res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || "INTERNAL_SERVER_ERROR", message: err.message }
    });
});

// =============================================================================
// 5. CONTROLLED DAEMON LIFE-CYCLE MANAGEMENT
// =============================================================================
const modules = [eventModule, paymentModule, notificationModule, registrationModule];

export async function bootstrap() {
    try {
        console.log("Connecting global messaging backbone pools (Kafka)...");
        await messageClient.connect();

        console.log("Starting transactional outbox sync engines...");
        await outboxPublisher.start();

        console.log("Initializing module daemons & event-driven consumers...");
        for (const targetModule of modules) {
            if (typeof targetModule.start === "function") {
                await targetModule.start();
            }
        }

        console.log("Application boot sequence fully synchronized.");
        return app;
    } catch (error) {
        console.error("Fatal system fallback occurred during bootstrap sequence:", error);
        throw error;
    }
}

export async function shutdown(server) {
    console.log("Termination signal caught: Initiating graceful drain process...");

    if (server) {
        await new Promise(resolve => server.close(resolve));
        console.log("HTTP gateway closed to new inbound traffic.");
    }

    // 1. Tell local module loops and Kafka consumers to stop reading new messages
    for (const targetModule of modules) {
        if (typeof targetModule.stop === "function") {
            try { await targetModule.stop(); } catch (e) { console.error("Error stopping module daemon:", e); }
        }
    }

    // 2. Stop the local outbox publisher from pulling pending events from the DB
    try {
        await outboxPublisher.stop();
        console.log("Outbox publisher drained and stopped successfully.");
    } catch (e) {
        console.error("Error stopping outbox publisher:", e);
    }

    // 3. Sever connection loops to the Kafka broker clusters cleanly
    try {
        await messageClient.disconnect();
        console.log("Kafka message broker clients disconnected cleanly.");
    } catch (e) {
        console.error("Error disconnecting Kafka pools:", e);
    }

    // 4. Drain remaining database pools
    if (db && typeof db.destroy === "function") {
        await db.destroy();
        console.log("Database connection pools closed.");
    }

    console.log("All systems safe. Offline exit sequence cleared.");
}

export default app;