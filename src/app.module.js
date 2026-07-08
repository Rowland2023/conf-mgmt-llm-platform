// src/app.module.js

import express from "express";

import { db } from "./shared/infrastructure/database/knex.js";

import { initEventModule } from "./modules/Event Schedule/index.js";
import { initPaymentModule } from "./modules/Payment/index.js";
import { initNotificationModule } from "./modules/Notification/index.js";
import { initRegistrationModule } from "./modules/registration/index.js";

const app = express();

// ----------------------------------------------------
// Global Middleware
// ----------------------------------------------------

app.use(express.json());

// app.use(cors());
// app.use(helmet());
// app.use(compression());
// app.use(requestLogger);
// app.use(requestId);

// ----------------------------------------------------
// Feature Modules
// ----------------------------------------------------

app.use("/api/events", initEventModule(db));
app.use("/api/payments", initPaymentModule(db));
app.use("/api/notifications", initNotificationModule(db));
app.use("/api/registrations", initRegistrationModule(db));

// ----------------------------------------------------
// Health Check
// ----------------------------------------------------

app.get("/", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "conference-management",
        version: "1.0.0"
    });
});

// ----------------------------------------------------
// 404 Handler
// ----------------------------------------------------

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: "ROUTE_NOT_FOUND",
            message: "The requested resource does not exist."
        }
    });
});

// ----------------------------------------------------
// Global Error Handler
// ----------------------------------------------------

app.use((err, req, res, next) => {

    console.error(err);

    const status = err.statusCode || 500;

    res.status(status).json({
        success: false,
        error: {
            code: err.code || "INTERNAL_SERVER_ERROR",
            message: err.message || "An unexpected error occurred."
        }
    });
});

export default app;