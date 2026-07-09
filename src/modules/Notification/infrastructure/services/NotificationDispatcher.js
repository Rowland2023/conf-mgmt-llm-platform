// src/modules/notification/application/services/NotificationDispatcher.js

import { CHANNELS } from "../../domain/entities/Notification.js";

export class NotificationDispatcher {
    constructor({
        emailProvider,
        smsProvider,
        pushProvider,
        logger = console
    }) {
        this.emailProvider = emailProvider;
        this.smsProvider = smsProvider;
        this.pushProvider = pushProvider;
        this.logger = logger;
    }

    /**
     * Dispatches a notification using the appropriate provider.
     *
     * @param {import("../../domain/entities/Notification.js").Notification} notification
     */
    async dispatch(notification) {
        switch (notification.channel) {
            case CHANNELS.EMAIL:
                return this.sendEmail(notification);

            case CHANNELS.SMS:
                return this.sendSMS(notification);

            case CHANNELS.PUSH:
                return this.sendPush(notification);

            default:
                throw new Error(
                    `Unsupported notification channel '${notification.channel}'.`
                );
        }
    }

    async sendEmail(notification) {
        this.ensureProvider(this.emailProvider, "Email");

        await this.emailProvider.send({
            to: notification.recipient,
            subject: notification.subject,
            body: notification.body,
            metadata: notification.metadata
        });

        this.logger.info?.({
            notificationId: notification.id,
            channel: notification.channel
        }, "Email notification sent.");
    }

    async sendSMS(notification) {
        this.ensureProvider(this.smsProvider, "SMS");

        await this.smsProvider.send({
            to: notification.recipient,
            message: notification.body,
            metadata: notification.metadata
        });

        this.logger.info?.({
            notificationId: notification.id,
            channel: notification.channel
        }, "SMS notification sent.");
    }

    async sendPush(notification) {
        this.ensureProvider(this.pushProvider, "Push");

        await this.pushProvider.send({
            recipient: notification.recipient,
            title: notification.title,
            body: notification.body,
            metadata: notification.metadata
        });

        this.logger.info?.({
            notificationId: notification.id,
            channel: notification.channel
        }, "Push notification sent.");
    }

    ensureProvider(provider, name) {
        if (!provider) {
            throw new Error(`${name} provider is not configured.`);
        }

        if (typeof provider.send !== "function") {
            throw new Error(`${name} provider must implement send().`);
        }
    }
}