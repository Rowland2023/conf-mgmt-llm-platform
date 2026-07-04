import express from 'express';
import eventScheduleRouter from './modules/Event Schedule/api/routes/event.routes.js'; 
import { createNotificationRouter } from './modules/Notification/api/notification.route.js';

// 1. IMPORT THE CORRECT FUNCTION AND CONTROLLERS
// (Make sure this relative path points correctly to your PaymentRoutes.js)
// Change this line to the actual location:
import { getPaymentRoutes } from './modules/Payment/api/payment.route.js';
import { notificationController } from './modules/Notification/api/notification.controller.js';
import { paymentController, paymentWebhookController } from './modules/Payment/api/payment.controller.js';

const app = express();

const notificationRouter = createNotificationRouter(notificationController);

// 2. BUILD THE EXPRESS ROUTER FROM THE ROUTES ARRAY
const paymentRouter = express.Router();
const routesConfig = getPaymentRoutes(paymentController, paymentWebhookController);

routesConfig.forEach((route) => {
  // Dynamically applies methods like paymentRouter.post() or paymentRouter.get()
  paymentRouter[route.method](route.path, ...route.middleware, route.handler);
});

// 3. MOUNT THE ROUTERS
app.use('/api/notifications', notificationRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/events', eventScheduleRouter);

app.get('/', (req, res) => {
  res.status(200).send('Hello World');
});

export default app;