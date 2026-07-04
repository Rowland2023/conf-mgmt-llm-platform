// presentation/http/controllers/PaymentController.js

export class PaymentController {
  // Dependencies are injected via the constructor
  constructor({ createPaymentUseCase, getPaymentByIdUseCase, getAllPaymentsUseCase, refundPaymentUseCase }) {
    this.createPaymentUseCase = createPaymentUseCase;
    this.getPaymentByIdUseCase = getPaymentByIdUseCase;
    this.getAllPaymentsUseCase = getAllPaymentsUseCase;
    this.refundPaymentUseCase = refundPaymentUseCase;
  }

  async createPayment(req, res, next) {
    try {
      // Extract data safely. You can also append req.user.id here for tracking
      const paymentData = {
        ...req.body,
        requestedBy: req.user?.id
      };

      const result = await this.createPaymentUseCase.execute(paymentData);
      return res.status(201).json(result);
    } catch (error) {
      // Pass errors to an Express global error-handling middleware instead of hardcoded 400s
      next(error); 
    }
  }

  async getPaymentById(req, res, next) {
    try {
      const result = await this.getPaymentByIdUseCase.execute({ 
        id: req.params.id,
        user: req.user // Pass user context to verify ownership inside the use case
      });
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAllPayments(req, res, next) {
    try {
      // Handle pagination and filtering queries cleanly
      const queryOptions = {
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status
      };

      const result = await this.getAllPaymentsUseCase.execute(queryOptions);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async refundPayment(req, res, next) {
    try {
      const result = await this.refundPaymentUseCase.execute({
        paymentId: req.params.id,
        amount: req.body.amount,
        requestedBy: req.user?.id
      });
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}