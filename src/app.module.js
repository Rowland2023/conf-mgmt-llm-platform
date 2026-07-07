import express from 'express';
import eventScheduleRouter from './modules/Event Schedule/api/routes/event.routes.js'; 
import { createNotificationRouter } from './modules/Notification/api/notification.route.js';

// 1. IMPORT THE CORRECT FUNCTION AND CONTROLLERS
import { getPaymentRoutes } from './modules/Payment/api/payment.route.js';
import { notificationController } from './modules/Notification/api/notification.controller.js';
import { paymentController, paymentWebhookController } from './modules/Payment/api/payment.controller.js';

// --- REGISTRATION MODULE IMPORT ---
import { initRegistrationModule } from './modules/registration/index.js';
// Replace this with your actual knex database connection instance import path
import { db } from './shared/infrastructure/database/knex.js'; 

const app = express();

// Standard Body Parser Middleware (required to read req.body inside schemas)
app.use(express.json());

const notificationRouter = createNotificationRouter(notificationController);

// 2. BUILD THE EXPRESS ROUTER FROM THE ROUTES ARRAY
const paymentRouter = express.Router();
const routesConfig = getPaymentRoutes(paymentController, paymentWebhookController);

routesConfig.forEach((route) => {
  // Dynamically applies methods like paymentRouter.post() or paymentRouter.get()
  paymentRouter[route.method](route.path, ...route.middleware, route.handler);
});

// --- REGISTRATION ROUTER INITIALIZATION ---
// Injecting the raw database connection straight into the self-wiring container
const registrationRouter = initRegistrationModule(db);

// 3. MOUNT THE ROUTERS
app.use('/api/notifications', notificationRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/events', eventScheduleRouter);

// Mount the clean REST API endpoint for registrations
app.use('/api/registrations', registrationRouter);

app.get('/', (req, res) => {
  res.status(200).send('Hello World');
});

export default app;