// src/modules/Event Schedule/api/routes/event.routes.js
import { Router } from 'express';

export default function createEventRouter(eventController) {
    const router = Router();

    // Middleware to extract tracing headers and explicitly stick them onto the request
    const extractTracing = (req, res, next) => {
        const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
        const causationId = req.headers['x-causation-id'] || null;

        if (correlationId) {
            // Attach them cleanly where your UseCase execution payload can see them
            if (req.method === 'GET' || req.method === 'DELETE') {
                req.query.correlationId = correlationId;
                req.query.causationId = causationId;
            } else {
                req.body.correlationId = correlationId;
                req.body.causationId = causationId;
            }
        }
        next();
    };

    router.use(extractTracing); // Apply it globally to all event routes

    router.post('/', eventController.createEvent);
    router.get('/', eventController.listEvents);
    router.get('/:id', eventController.getEventById);
    router.patch('/:id/reschedule', eventController.rescheduleEvent);
    router.delete('/:id', eventController.cancelEvent);

    return router;
}