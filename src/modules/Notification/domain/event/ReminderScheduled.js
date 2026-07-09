// src/modules/notification/domain/events/ReminderScheduled.js
import { randomUUID } from "crypto";

function deepFreeze(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj!== "object" || Object.isFrozen(obj)) return obj;
  if (seen.has(obj)) return obj;
  seen.add(obj);
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(key => deepFreeze(obj[key], seen));
  return obj;
}

export class ReminderScheduled {
  constructor({ notificationId, conferenceId, userId, scheduledFor, correlationId, causationId, now = new Date() }) {
    if (!notificationId) throw new Error("notificationId required");
    if (!conferenceId) throw new Error("conferenceId required");
    if (!userId) throw new Error("userId required");
    if (!scheduledFor) throw new Error("scheduledFor required");

    const schedDate = new Date(scheduledFor);
    if (isNaN(schedDate.getTime())) throw new Error("scheduledFor must be valid date");
    if (schedDate <= now) throw new Error("scheduledFor must be future");

    this.id = randomUUID();
    this.aggregateId = notificationId;
    this.aggregateType = "Notification";
    this.type = "ReminderScheduled";
    this.version = 1;
    this.occurredAt = new Date().toISOString();
    this.correlationId = correlationId || null;
    this.causationId = causationId || null;

    this.payload = deepFreeze({
      notificationId,
      conferenceId,
      userId, // NO recipient
      scheduledFor: schedDate.toISOString()
    });

    return deepFreeze(this);
  }
}