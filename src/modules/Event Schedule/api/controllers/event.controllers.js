// Corrected paths (up 3 levels) and added ListEventsUseCase import
// event.controllers.js
import { CreateEventUseCase } from "../../application/create-event.usecase.js";
import { GetEventByIdUseCase } from "../../application/get-event.usecase.js"; 
import { RescheduleEventUseCase } from "../../application/reschedule-event.usecase.js";
import { CancelEventUseCase } from "../../application/cancel-event.usecase.js";
import { ListEventUseCase } from "../../application/list-event.usecase.js";

export class EventController {   
    static async createEvent(req, res, next) {
        try {
            const result = await CreateEventUseCase.execute(req.body);
            return res.status(201).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async listEvents(req, res, next) {
        try {
            const result = await ListEventsUseCase.execute(req.query); 
            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getEventById(req, res, next) {
        try {
            // FIXED: Changed GetEventUseCase to GetEventByIdUseCase to match the import
            const result = await GetEventByIdUseCase.execute(req.params.id);
            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async rescheduleEvent(req, res, next) {
        try {
            const result = await RescheduleEventUseCase.execute({ eventId: req.params.id, newDate: req.body.newDate });
            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async cancelEvent(req, res, next) {
        try {
            const result = await CancelEventUseCase.execute(req.params.id);
            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }   
    }
}