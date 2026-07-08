// src/modules/Event Schedule/api/routes/event.routes.js

import { Router } from 'express';

export default function createEventRouter(eventController) {

    const router = Router();

    router.post(
        '/',
        eventController.createEvent
    );

    router.get(
        '/',
        eventController.listEvents
    );

    router.get(
        '/:id',
        eventController.getEventById
    );

    router.patch(
        '/:id/reschedule',
        eventController.rescheduleEvent
    );

    router.delete(
        '/:id',
        eventController.cancelEvent
    );

    return router;
}