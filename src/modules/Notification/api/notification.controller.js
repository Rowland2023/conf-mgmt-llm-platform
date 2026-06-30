export class NotificationController {
  constructor({
    sendEmailUseCase,
    sendSMSUseCase,
    sendPushNotificationUseCase,
    updateNotificationUseCase,
    deleteNotificationUseCase,
    listNotificationsUseCase,
    getNotificationUseCase
  }) {
    this.sendEmailUseCase = sendEmailUseCase;
    this.sendSMSUseCase = sendSMSUseCase;
    this.sendPushNotificationUseCase = sendPushNotificationUseCase;
    this.updateNotificationUseCase = updateNotificationUseCase;
    this.deleteNotificationUseCase = deleteNotificationUseCase;
    this.listNotificationsUseCase = listNotificationsUseCase;
    this.getNotificationUseCase = getNotificationUseCase;
  }

  /**
   * Fetch a history/list of notifications for an attendee, speaker, or organizer.
   * GET /notifications
   */
  async list(req, res, next) {
    try {
      const result = await this.listNotificationsUseCase.execute({
        tenantId: req.user?.tenantId, // Separates different conferences or organizer organizations
        userId: req.user?.id,
        ...req.query                  // Supports filtering by status (read/unread) or pagination
      });

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetch details of a specific notification log.
   * GET /notifications/:id
   */
  async get(req, res, next) {
    try {
      const result = await this.getNotificationUseCase.execute({
        id: req.params.id,
        tenantId: req.user?.tenantId
      });

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger an email notification (e.g., Ticket Purchase Invoices, Speaker Invites).
   * POST /notifications/email
   */
  async sendEmail(req, res, next) {
    try {
      const result = await this.sendEmailUseCase.execute({
        ...req.body,
        requestedBy: req.user?.id,
        tenantId: req.user?.tenantId,
        idempotencyKey: req.headers["idempotency-key"] // Prevents duplicate ticket emails on unstable connections
      });

      return res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger an SMS notification (e.g., Critical Schedule Changes, Urgent Venue Alterations).
   * POST /notifications/sms
   */
  async sendSMS(req, res, next) {
    try {
      const result = await this.sendSMSUseCase.execute({
        ...req.body,
        requestedBy: req.user?.id,
        tenantId: req.user?.tenantId,
        idempotencyKey: req.headers["idempotency-key"]
      });

      return res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger a push notification to mobile apps (e.g., "Session starting in 10 mins").
   * POST /notifications/push
   */
  async sendPush(req, res, next) {
    try {
      const result = await this.sendPushNotificationUseCase.execute({
        ...req.body,
        requestedBy: req.user?.id,
        tenantId: req.user?.tenantId,
        idempotencyKey: req.headers["idempotency-key"]
      });

      return res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a notification status (e.g., an attendee marking an in-app alert as 'READ').
   * PUT /notifications/:id
   */
  async update(req, res, next) {
    try {
      const result = await this.updateNotificationUseCase.execute({
        id: req.params.id,
        ...req.body,
        requestedBy: req.user?.id,
        tenantId: req.user?.tenantId
      });

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Soft-delete or clear a notification from an attendee's view.
   * DELETE /notifications/:id
   */
  async delete(req, res, next) {
    try {
      await this.deleteNotificationUseCase.execute({
        id: req.params.id,
        requestedBy: req.user?.id,
        tenantId: req.user?.tenantId
      });

      return res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  }
}