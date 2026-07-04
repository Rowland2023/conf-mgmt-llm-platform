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
    if (!sendEmailUseCase) throw new Error('sendEmailUseCase is required');
    if (!sendSMSUseCase) throw new Error('sendSMSUseCase is required');
    if (!sendPushNotificationUseCase) throw new Error('sendPushNotificationUseCase is required');
    if (!updateNotificationUseCase) throw new Error('updateNotificationUseCase is required');
    if (!deleteNotificationUseCase) throw new Error('deleteNotificationUseCase is required');
    if (!listNotificationsUseCase) throw new Error('listNotificationsUseCase is required');
    if (!getNotificationUseCase) throw new Error('getNotificationUseCase is required');

    this.sendEmailUseCase = sendEmailUseCase;
    this.sendSMSUseCase = sendSMSUseCase;
    this.sendPushNotificationUseCase = sendPushNotificationUseCase;
    this.updateNotificationUseCase = updateNotificationUseCase;
    this.deleteNotificationUseCase = deleteNotificationUseCase;
    this.listNotificationsUseCase = listNotificationsUseCase;
    this.getNotificationUseCase = getNotificationUseCase;

    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.sendEmail = this.sendEmail.bind(this);
    this.sendSMS = this.sendSMS.bind(this);
    this.sendPush = this.sendPush.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  async list(req, res, next) {
    try {
      const result = await this.listNotificationsUseCase.execute({
        tenantId: req.user?.tenantId,
        userId: req.user?.id,
        ...req.query
      });

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

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

  async sendEmail(req, res, next) {
    try {
      const result = await this.sendEmailUseCase.execute({
        ...req.body,
        requestedBy: req.user?.id,
        tenantId: req.user?.tenantId,
        idempotencyKey: req.headers['idempotency-key']
      });

      return res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  }

  async sendSMS(req, res, next) {
    try {
      const result = await this.sendSMSUseCase.execute({
        ...req.body,
        requestedBy: req.user?.id,
        tenantId: req.user?.tenantId,
        idempotencyKey: req.headers['idempotency-key']
      });

      return res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  }

  async sendPush(req, res, next) {
    try {
      const result = await this.sendPushNotificationUseCase.execute({
        ...req.body,
        requestedBy: req.user?.id,
        tenantId: req.user?.tenantId,
        idempotencyKey: req.headers['idempotency-key']
      });

      return res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  }

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