import { randomUUID } from "crypto";
import { NotificationQueued } from "../events/NotificationQueued.js";
import { NotificationSent } from "../events/NotificationSent.js";
import { NotificationFailed } from "../events/NotificationFailed.js";
import { NotificationRead } from "../events/NotificationRead.js";
import { ReminderCancelled } from "../events/ReminderCancelled.js";
import { ReminderDelivered } from "../events/ReminderDelivered.js";

export const CHANNELS = Object.freeze({
    EMAIL: "email",
    SMS: "sms",
    PUSH: "push"
});

export const STATUS = Object.freeze({
    PENDING: "pending",
    SCHEDULED: "scheduled",
    SENT: "sent",
    FAILED: "failed",
    CANCELLED: "cancelled",
    READ: "read"
});

export class Notification {
    constructor({
        id = randomUUID(),
        userId = null,
        conferenceId = null,
        recipient,
        channel,
        subject = null,
        title = null,
        body,
        metadata = {},
        status = STATUS.PENDING,
        createdAt = new Date(),
        scheduledFor = null,
        sentAt = null,
        readAt = null
    }) {
        this.id = id;
        this.userId = userId;
        this.conferenceId = conferenceId;
        this.recipient = recipient;
        this.channel = channel;
        this.subject = subject;
        this.title = title;
        this.body = body;
        this.metadata = Object.freeze({ ...metadata });
        this.status = status;
        this.createdAt = createdAt;
        this.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
        this.sentAt = sentAt ? new Date(sentAt) : null;
        this.readAt = readAt ? new Date(readAt) : null;

        this.domainEvents = [];
    }

    // -----------------------------------------------------------------
    // Factory Boundaries
    // -----------------------------------------------------------------

    static createEmail({ userId, recipient, subject, body, metadata = {} }) {
        if (!recipient) throw new Error("Validation Error: Recipient email is required.");
        if (!subject) throw new Error("Validation Error: Email subject is required.");
        if (!body) throw new Error("Validation Error: Email body is required.");

        const notification = new Notification({
            userId,
            recipient,
            subject,
            body,
            metadata,
            channel: CHANNELS.EMAIL
        });

        notification.recordEvent(new NotificationQueued({
            notificationId: notification.id,
            userId: notification.userId,
            recipient: notification.recipient,
            channel: notification.channel,
            metadata: notification.metadata
        }));

        return notification;
    }

    static createSMS({ userId, recipient, message, metadata = {} }) {
        if (!recipient) throw new Error("Validation Error: Recipient phone number is required.");
        if (!message) throw new Error("Validation Error: SMS message is required.");

        const notification = new Notification({
            userId,
            recipient,
            body: message,
            metadata,
            channel: CHANNELS.SMS
        });

        notification.recordEvent(new NotificationQueued({
            notificationId: notification.id,
            userId: notification.userId,
            recipient: notification.recipient,
            channel: notification.channel,
            metadata: notification.metadata
        }));

        return notification;
    }

    static createPush({ userId, recipient, title, body, metadata = {} }) {
        if (!recipient) throw new Error("Validation Error: Push recipient is required.");
        if (!title) throw new Error("Validation Error: Push title is required.");
        if (!body) throw new Error("Validation Error: Push body is required.");

        const notification = new Notification({
            userId,
            recipient,
            title,
            body,
            metadata,
            channel: CHANNELS.PUSH
        });

        notification.recordEvent(new NotificationQueued({
            notificationId: notification.id,
            userId: notification.userId,
            recipient: notification.recipient,
            channel: notification.channel,
            metadata: notification.metadata
        }));

        return notification;
    }

    static scheduleConferenceReminder({ userId, conferenceId, recipient, channel, subject, title, body, scheduledFor, metadata = {} }) {
        if (!conferenceId) throw new Error("Validation Error: A conference context identifier is strictly required.");
        if (!scheduledFor || new Date(scheduledFor) <= new Date()) {
            throw new Error("Validation Error: 'scheduledFor' date must be a valid point in the future.");
        }

        const notification = new Notification({
            userId,
            conferenceId,
            recipient,
            channel,
            subject,
            title,
            body,
            metadata,
            status: STATUS.SCHEDULED,
            scheduledFor
        });

        notification.recordEvent(new NotificationQueued({
            notificationId: notification.id,
            userId: notification.userId,
            recipient: notification.recipient,
            channel: notification.channel,
            metadata: { ...metadata, scheduledFor: notification.scheduledFor.toISOString() }
        }));

        return notification;
    }

    // -----------------------------------------------------------------
    // Domain State Machine Mutations & Lifecycle Rules
    // -----------------------------------------------------------------

    markAsSent() {
        if (this.status === STATUS.SENT || this.status === STATUS.READ || this.status === STATUS.CANCELLED) {
            return;
        }

        const explicitReminderContext = this.conferenceId !== null;
        this.status = STATUS.SENT;
        this.sentAt = new Date();

        // Branch dynamically to target the precise bounded-context domain event type
        if (explicitReminderContext) {
            this.recordEvent(new ReminderDelivered({
                notificationId: this.id,
                conferenceId: this.conferenceId,
                userId: this.userId,
                recipient: this.recipient,
                channel: this.channel,
                metadata: this.metadata
            }));
        } else {
            this.recordEvent(new NotificationSent({
                notificationId: this.id,
                userId: this.userId,
                recipient: this.recipient,
                channel: this.channel,
                metadata: this.metadata
            }));
        }
    }

    markAsFailed(reason) {
        if (this.status === STATUS.READ || this.status === STATUS.CANCELLED) {
            return;
        }

        this.status = STATUS.FAILED;

        this.recordEvent(new NotificationFailed({
            notificationId: this.id,
            channel: this.channel,
            recipient: this.recipient,
            reason,
            metadata: this.metadata
        }));
    }

    cancelReminder(reason) {
        if (this.status !== STATUS.SCHEDULED) {
            throw new Error(`Domain Error: Active notifications in state '${this.status}' cannot be cancelled.`);
        }

        this.status = STATUS.CANCELLED;

        this.recordEvent(new ReminderCancelled({
            notificationId: this.id,
            conferenceId: this.conferenceId,
            recipient: this.recipient,
            reason: reason || "User requested cancellation",
            metadata: this.metadata
        }));
    }

    markAsRead() {
        if (this.status === STATUS.READ || this.readAt) {
            return;
        }

        if (!this.userId) {
            throw new Error("Domain Error: Cannot mark a notification as read when no associated 'userId' exists.");
        }

        this.readAt = new Date();
        this.status = STATUS.READ;

        this.recordEvent(new NotificationRead({
            notificationId: this.id,
            userId: this.userId,
            recipient: this.recipient,
            channel: this.channel,
            metadata: this.metadata
        }));
    }

    // -----------------------------------------------------------------
    // Event Transaction Handlers
    // -----------------------------------------------------------------

    recordEvent(eventInstance) {
        this.domainEvents.push(eventInstance);
    }

    pullEvents() {
        const events = [...this.domainEvents];
        this.domainEvents.length = 0; 
        return events;
    }
}