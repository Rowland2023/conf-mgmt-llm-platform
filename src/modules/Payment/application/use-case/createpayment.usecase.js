// application/use-cases/CreatePaymentUseCase.js

import {
  ValidationError,
  GatewayError,
} from "../../domain/errors/PaymentErrors.js";

import { Payment } from "../../domain/entities/Payment.js";
import { PaymentStatus } from "../../domain/constants/PaymentStatus.js";

const SUPPORTED_CURRENCIES = new Set(["NGN", "USD", "GBP"]);

export class CreatePaymentUseCase {
  constructor({
    paymentRepository,
    paymentGateway,
    logger,
    clock,
    idGenerator,
  }) {
    this.paymentRepository = paymentRepository;
    this.paymentGateway = paymentGateway;
    this.logger = logger;
    this.clock = clock;
    this.idGenerator = idGenerator;
  }

  async execute(command) {
    this.validate(command);

    const {
      bookingId,
      amount,
      currency = "NGN",
      email,
      tenantId,
      requestedBy,
      idempotencyKey,
    } = command;

    // ----------------------------
    // Idempotency
    // ----------------------------

    const existing =
      await this.paymentRepository.findByIdempotencyKey(
        tenantId,
        idempotencyKey
      );

    if (existing) {
      return existing.toResponse();
    }

    // ----------------------------
    // Create Payment Intent
    // ----------------------------

    const payment = Payment.create({
      id: this.idGenerator.generate(),
      bookingId,
      tenantId,
      amount,
      currency,
      email,
      createdBy: requestedBy,
      createdAt: this.clock.now(),
      status: PaymentStatus.PENDING,
      idempotencyKey,
    });

    await this.paymentRepository.save(payment);

    let gatewaySession;

    try {
      gatewaySession =
        await this.paymentGateway.initializeTransaction({
          reference: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          email: payment.email,
          metadata: payment.gatewayMetadata(),
        });

    } catch (error) {

      payment.markFailed(
        `Gateway initialization failed: ${error.message}`
      );

      await this.paymentRepository.update(payment);

      throw new GatewayError(
        "Unable to initialize payment.",
        {
          cause: error,
        }
      );
    }

    // ----------------------------
    // Sync External Reference
    // ----------------------------

    try {

      payment.markGatewayInitialized(
        gatewaySession.reference
      );

      await this.paymentRepository.update(payment);

    } catch (error) {

      this.logger.error(
        "Gateway initialized but database update failed.",
        {
          paymentId: payment.id,
          tenantId,
          reference: gatewaySession.reference,
          error,
        }
      );
    }

    return {
      paymentId: payment.id,
      externalReference: gatewaySession.reference,
      checkoutUrl: gatewaySession.checkoutUrl,
      status: payment.status,
    };
  }

  validate({
    bookingId,
    amount,
    currency,
    email,
    idempotencyKey,
  }) {

    if (!bookingId) {
      throw new ValidationError("bookingId is required.");
    }

    if (!email) {
      throw new ValidationError("email is required.");
    }

    if (!idempotencyKey) {
      throw new ValidationError("idempotencyKey is required.");
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError(
        "Amount must be a positive integer."
      );
    }

    if (!SUPPORTED_CURRENCIES.has(currency)) {
      throw new ValidationError(
        `Unsupported currency: ${currency}`
      );
    }
  }
}