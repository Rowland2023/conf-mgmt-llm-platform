// src/modules/event-schedule/domain/service/scheduling.service.js
import { Event } from '../entities/event.entities.js';

export class EventSchedulingService {
    constructor({ eventRepository }) {
        this.eventRepository = eventRepository;
    }

    async schedule({ title, roomId, startTime, endTime }) {
        const hasConflict = await this.eventRepository.existsOverlappingEvent(
            roomId,
            startTime,
            endTime
        );

        if (hasConflict) {
            throw new Error('Room already has a scheduled event.');
        }

        return Event.create({
            title,
            roomId, // matches entity
            startTime,
            endTime
        });
    }

    async reschedule(event, newStartTime, newEndTime) {
        const hasConflict = await this.eventRepository.existsOverlappingEvent(
            event.roomId, // matches entity
            newStartTime,
            newEndTime,
            event.id
        );

        if (hasConflict) {
            throw new Error('Room already has a scheduled event.');
        }

        event.reschedule({ startTime: newStartTime, endTime: newEndTime }); // fix signature

        return event;
    }

    cancel(event) {
        event.cancel();
        return event;
    }
}