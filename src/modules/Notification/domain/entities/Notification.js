export class Notification extends Entity {
    constructor({
        id,
        userId = null,
        contextType, // 'conference', 'payment', 'escrow'
        contextId,
        recipient,
        channel,
        templateKey, // 'funds_released', 'reminder_24h'
        subject = null,
        title = null,
        body,
        metadata = {},
        status = STATUS.PENDING,
        correlationId = null,
        version = 0,
        createdAt = new Date(),
        scheduledFor = null,
        sentAt = null,
        deliveredAt = null,
        readAt = null,
        providerMessageId = null
    }) {
        super(id);
        this.userId = userId;
        this.contextType = contextType;
        this.contextId = contextId;
        this.recipient = recipient;
        this.channel = channel;
        this.templateKey = templateKey;
        this.subject = subject;
        this.title = title;
        this.body = body;
        this.metadata = Object.freeze({ ...metadata });
        this.status = status;
        this.correlationId = correlationId;
        this.version = version;
        this.createdAt = new Date(createdAt);
        this.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
        this.sentAt = sentAt ? new Date(sentAt) : null;
        this.deliveredAt = deliveredAt ? new Date(deliveredAt) : null;
        this.readAt = readAt ? new Date(readAt) : null;
        this.providerMessageId = providerMessageId;
    }

    // Factory now emits correct event
    static schedule({ userId, contextType, contextId, recipient, channel, templateKey, body, scheduledFor, correlationId, decidedAt }) {
        const notification = new Notification({
            userId, contextType, contextId, recipient, channel, templateKey, body,
            status: STATUS.SCHEDULED,
            scheduledFor,
            correlationId
        });

        notification.recordEvent(new ReminderScheduled({
            notificationId: notification.id,
            contextType: notification.contextType,
            contextId: notification.contextId,
            userId: notification.userId,
            templateKey: notification.templateKey,
            scheduledFor: notification.scheduledFor,
            decidedAt,
            correlationId
        }));

        return notification;
    }

    // Split sent vs delivered
    markAsSent({ sentAt, providerMessageId }) {
        if (this.status !== STATUS.PENDING && this.status !== STATUS.SCHEDULED) {
            throw new ValidationError(`Cannot send notification in status ${this.status}`);
        }
        if (!sentAt) throw new ValidationError("sentAt required");

        this.status = STATUS.SENT;
        this.sentAt = new Date(sentAt);
        this.providerMessageId = providerMessageId;

        this.recordEvent(new NotificationSent({
            notificationId: this.id,
            userId: this.userId,
            contextType: this.contextType,
            contextId: this.contextId,
            channel: this.channel,
            sentAt: this.sentAt,
            providerMessageId: this.providerMessageId,
            correlationId: this.correlationId
        }));
    }

    markAsDelivered({ deliveredAt, providerMessageId }) {
        if (this.status !== STATUS.SENT) {
            throw new ValidationError(`Cannot mark delivered from status ${this.status}`);
        }
        if (!deliveredAt) throw new ValidationError("deliveredAt required");

        this.deliveredAt = new Date(deliveredAt);
        this.providerMessageId = providerMessageId || this.providerMessageId;

        this.recordEvent(new ReminderDelivered({
            notificationId: this.id,
            contextType: this.contextType,
            contextId: this.contextId,
            userId: this.userId,
            channel: this.channel,
            deliveredAt: this.deliveredAt,
            providerMessageId: this.providerMessageId,
            correlationId: this.correlationId
        }));
    }

    cancel({ cancelledAt, cancelledBy, reason }) {
        if (this.status !== STATUS.SCHEDULED && this.status !== STATUS.PENDING) {
            throw new ValidationError(`Cannot cancel notification in status ${this.status}`);
        }
        if (!cancelledAt) throw new ValidationError("cancelledAt required");

        this.status = STATUS.CANCELLED;

        this.recordEvent(new ReminderCancelled({
            notificationId: this.id,
            contextType: this.contextType,
            contextId: this.contextId,
            cancelledBy,
            reason,
            cancelledAt,
            correlationId: this.correlationId
        }));
    }
}