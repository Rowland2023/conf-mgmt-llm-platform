import { Router } from 'express';
// Assuming the path to your controller instance or class
// If using an DI container, you'll pass the resolved instance here

export function createNotificationRouter(notificationController) {
  const router = Router();

  // 1. Get all notifications (Queries: pagination, filters)
  router.get('/', (req, res, next) => notificationController.list(req, res, next));

  // 2. Get a single notification by ID
  router.get('/:id', (req, res, next) => notificationController.get(req, res, next));

  // 3. Send/Trigger specific notification types (POST actions)
  router.post('/email', (req, res, next) => notificationController.sendEmail(req, res, next));
  router.post('/sms', (req, res, next) => notificationController.sendSMS(req, res, next));
  router.post('/push', (req, res, next) => notificationController.sendPush(req, res, next));

  // 4. Update and Delete management routes
  router.put('/:id', (req, res, next) => notificationController.update(req, res, next));
  router.delete('/:id', (req, res, next) => notificationController.delete(req, res, next));

  return router;
}