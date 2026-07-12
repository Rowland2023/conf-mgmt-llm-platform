// presentation/http/controllers/PaymentController.js

export class PaymentController {
  /**
   * Dependencies are injected via the dependency injection container.
   * @param {Object} deps
   * @param {import('../../../ports/ILogger.js').ILogger} deps.logger
   * @param {Object} deps.createPaymentUseCase
   * @param {Object} deps.getPaymentByIdUseCase
   * @param {Object} deps.getAllPaymentsUseCase
   * @param {Object} deps.refundPaymentUseCase
   */
  constructor({ logger, createPaymentUseCase, getPaymentByIdUseCase, getAllPaymentsUseCase, refundPaymentUseCase }) {
    this.logger = logger;
    this.createPaymentUseCase = createPaymentUseCase;
    this.getPaymentByIdUseCase = getPaymentByIdUseCase;
    this.getAllPaymentsUseCase = getAllPaymentsUseCase;
    this.refundPaymentUseCase = refundPaymentUseCase;
  }

  async createPayment(req, res, next) {
    const startedAt = Date.now();
    
    // Extract or initialize structural trace chains from incoming network headers
    const correlationId = req.headers['x-correlation-id'] || globalThis.crypto?.randomUUID();
    const causationId = req.headers['x-request-id'] || null;

    const logger = this.logger.child({
      component: 'PaymentController',
      action: 'createPayment',
      httpMethod: req.method,
      url: req.originalUrl,
      correlationId,
      causationId,
      userId: req.user?.id,
      tenantId: req.body?.tenantId
    });

    // Sanitize inbound logging payloads to safeguard data privacy compliance
    logger.info('Received HTTP request to initiate payment processing', {
      payloadSummary: {
        currency: req.body?.currency,
        amount: req.body?.amount,
        gateway: req.body?.gateway
      }
    });

    try {
      const paymentData = {
        ...req.body,
        requestedBy: req.user?.id,
        correlationId,
        causationId
      };

      const result = await this.createPaymentUseCase.execute(paymentData);
      
      logger.info('HTTP payment creation request fulfilled successfully', { 
        durationMs: Date.now() - startedAt 
      });
      
      return res.status(201).json(result);
    } catch (error) {
      logger.error('HTTP payment creation request processing failed', error, { 
        durationMs: Date.now() - startedAt 
      });
      next(error); 
    }
  }

  async getPaymentById(req, res, next) {
    const startedAt = Date.now();
    const correlationId = req.headers['x-correlation-id'] || globalThis.crypto?.randomUUID();

    const logger = this.logger.child({
      component: 'PaymentController',
      action: 'getPaymentById',
      httpMethod: req.method,
      url: req.originalUrl,
      correlationId,
      userId: req.user?.id,
      paymentId: req.params.id
    });

    logger.info('Received HTTP request to retrieve payment by identifier');

    try {
      const result = await this.getPaymentByIdUseCase.execute({ 
        id: req.params.id,
        user: req.user,
        correlationId
      });
      
      logger.info('HTTP payment retrieval completed', { 
        durationMs: Date.now() - startedAt 
      });
      
      return res.status(200).json(result);
    } catch (error) {
      logger.error('HTTP payment retrieval failed', error, { 
        durationMs: Date.now() - startedAt 
      });
      next(error);
    }
  }

  async getAllPayments(req, res, next) {
    const startedAt = Date.now();
    const correlationId = req.headers['x-correlation-id'] || globalThis.crypto?.randomUUID();

    const logger = this.logger.child({
      component: 'PaymentController',
      action: 'getAllPayments',
      httpMethod: req.method,
      url: req.originalUrl,
      correlationId,
      userId: req.user?.id
    });

    logger.info('Received HTTP query request for multi-record collection tracking', {
      filters: {
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status
      }
    });

    try {
      const queryOptions = {
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status,
        correlationId
      };

      const result = await this.getAllPaymentsUseCase.execute(queryOptions);
      
      logger.info('HTTP multi-record collection query executed successfully', { 
        durationMs: Date.now() - startedAt,
        recordCount: result?.data?.length || 0
      });
      
      return res.status(200).json(result);
    } catch (error) {
      logger.error('HTTP multi-record collection query failed execution', error, { 
        durationMs: Date.now() - startedAt 
      });
      next(error);
    }
  }

  async refundPayment(req, res, next) {
    const startedAt = Date.now();
    const correlationId = req.headers['x-correlation-id'] || globalThis.crypto?.randomUUID();
    const causationId = req.headers['x-request-id'] || null;

    const logger = this.logger.child({
      component: 'PaymentController',
      action: 'refundPayment',
      httpMethod: req.method,
      url: req.originalUrl,
      correlationId,
      causationId,
      userId: req.user?.id,
      paymentId: req.params.id
    });

    logger.info('Received HTTP execution request to process ledger refund', {
      refundAmount: req.body?.amount
    });

    try {
      const result = await this.refundPaymentUseCase.execute({
        paymentId: req.params.id,
        amount: req.body.amount,
        requestedBy: req.user?.id,
        correlationId,
        causationId
      });
      
      logger.info('HTTP payment ledger refund executed safely', { 
        durationMs: Date.now() - startedAt 
      });
      
      return res.status(200).json(result);
    } catch (error) {
      logger.error('HTTP payment ledger refund processing broken out by validation error', error, { 
        durationMs: Date.now() - startedAt 
      });
      next(error);
    }
  }
}