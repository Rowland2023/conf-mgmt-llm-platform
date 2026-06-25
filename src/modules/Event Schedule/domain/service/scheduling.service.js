import { Event } from '../entities/event.entity.js';

export class SchedulingService {
     static create({ title, roomID, startTime, endTime }) {
        const event = Event.create({ title, roomID, startTime, endTime });
        return event;
    }



    static cancel(event) {
        event.cancel();
        return event;
    }

    static reschedule(event, newDate) {
        event.reschedule(newDate);
        return event;
    }
}