import {Router} from'express';
import {EventController} from "../controllers/event.controllers.js";

const router = Router();

router.post('/', EventController.createEvent);
router.get('/', EventController.listEvents);
router.get('/:id', EventController.getEventById);
router.patch('/:id/reschedule', EventController.rescheduleEvent);
router.delete('/:id', EventController.cancelEvent);

export default router;