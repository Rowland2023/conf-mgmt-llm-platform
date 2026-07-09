// src/modules/Event Schedule/domain/entities/event.entities.js
import { randomUUID } from "crypto";

export class Event {
  constructor({
    id = randomUUID(),
    title,
    roomID,
    startTime,
    endTime,
    status = "Scheduled",
  }) {
    this.id = id;
    this.title = title;
    this.roomID = roomID;
    this.startTime = startTime;
    this.endTime = endTime;
    this.status = status;

    // 👉 ADD THIS: Crucial for your Transactional Outbox!
    this.domainEvents = []; 
  }

  static create({ title, roomID, startTime, endTime }) {
    if (!title?.trim()) {
      throw new Error("Title is required");
    }
    if (startTime >= endTime) {
      throw new Error("Start time must be before end time");
    }

    const event = new Event({ title, roomID, startTime, endTime });

    // 👉 ADD THIS: Record that the event was created
    event.domainEvents.push({
      type: "EventCreated",
      payload: { eventId: event.id, title, roomID, startTime, endTime }
    });

    return event;
  }

  cancel() {
    if (this.status === "Cancelled") {
      throw new Error("Event is already cancelled");
    }

    this.status = "Cancelled";

    // 👉 ADD THIS: Record the cancellation event
    this.domainEvents.push({
      type: "EventCancelled",
      payload: { eventId: this.id }
    });
  }

  reschedule({ startTime, endTime }) {
    if (this.status === "Cancelled") {
      throw new Error("Cannot reschedule a cancelled event");
    }
    if (startTime >= endTime) {
      throw new Error("Start time must be before end time");
    }

    this.startTime = startTime;
    this.endTime = endTime;

    // 👉 ADD THIS: Record the rescheduling event
    this.domainEvents.push({
      type: "EventRescheduled",
      payload: { eventId: this.id, startTime, endTime }
    });
  }

  // 👉 ADD THIS: Let the repository pull events out to save them to the outbox table
  pullEvents() {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }
}