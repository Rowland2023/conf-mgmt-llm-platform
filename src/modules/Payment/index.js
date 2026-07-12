// modules/payment/index.js

import { PostgresPaymentRepository } from "./infrastructure/persistence/repositories/PostgresPaymentRepository.js";
import { PaymentMapper } from "./infrastructure/persistence/mappers/PaymentMapper.js";

import { PaystackPaymentGateway } from "./infrastructure/gateways/PaystackPaymentGateway.js";
import { StripePaymentGateway } from "./infrastructure/gateways/StripePaymentGateway.js";

import { RedisLockManager } from "./infrastructure/locks/RedisLockManager.js";

import { PaystackWebhookVerifier } from "./infrastructure/webhook/PaystackWebhookVerifier.js";
import { StripeWebhookVerifier } from "./infrastructure/webhook/StripeWebhookVerifier.js";

import { CreatePaymentUseCase } from "./application/use-cases/CreatePaymentUseCase.js";
import { GetAllPaymentUseCase } from "./application/use-cases/GetAllPaymentUseCase.js";
import { RefundPaymentUseCase } from "./application/use-cases/RefundPaymentUseCase.js";
import { GetPaymentByIdUseCase } from "./application/use-cases/GetPaymentByIdUseCase.js";


import { PaymentController } from "./api/index.js";


export function createPaymentModule({
  db,
  redis,
  logger,
  outboxRepository,
  eventBus,
  config
}) {

  //
  // Infrastructure
  //

  const paymentMapper = new PaymentMapper();

  const paymentRepository =
    new PostgresPaymentRepository({
      db,
      paymentMapper
    });

  const lockManager =
    new RedisLockManager({
      redis
    });

  const paystackGateway =
    new PaystackPaymentGateway({
      config,
      logger
    });

  const stripeGateway =
    new StripePaymentGateway({
      config,
      logger
    });

  const paystackWebhookVerifier =
    new PaystackWebhookVerifier({
      secret: config.paystack.webhookSecret
    });

  const stripeWebhookVerifier =
    new StripeWebhookVerifier({
      secret: config.stripe.webhookSecret
    });



  //
  // Application
  //

  const createPaymentUseCase =
    new CreatePaymentUseCase({
      paymentRepository,
      paystackGateway,
      stripeGateway,
      outboxRepository,
      lockManager,
      logger
    });

  const completePaymentUseCase =
    new CompletePaymentUseCase({
      paymentRepository,
      outboxRepository,
      logger
    });

  const refundPaymentUseCase =
    new RefundPaymentUseCase({
      paymentRepository,
      paystackGateway,
      stripeGateway,
      outboxRepository,
      lockManager,
      logger
    });

  const cancelPaymentUseCase =
    new CancelPaymentUseCase({
      paymentRepository,
      outboxRepository,
      logger
    });

  const handlePaymentWebhookUseCase =
    new HandlePaymentWebhookUseCase({
      paymentRepository,
      paystackGateway,
      stripeGateway,
      paystackWebhookVerifier,
      stripeWebhookVerifier,
      outboxRepository,
      lockManager,
      logger
    });



  //
  // Presentation
  //

  const paymentController =
    new PaymentController({
      createPaymentUseCase,
      completePaymentUseCase,
      refundPaymentUseCase,
      cancelPaymentUseCase,
      handlePaymentWebhookUseCase,
      logger
    });

  const router =
    createPaymentRouter({
      paymentController
    });



  //
  // Module API
  //

  return {
    router,

    controller: paymentController,

    repositories: {
      paymentRepository
    },

    gateways: {
      paystackGateway,
      stripeGateway
    },

    useCases: {
      createPaymentUseCase,
      completePaymentUseCase,
      refundPaymentUseCase,
      cancelPaymentUseCase,
      handlePaymentWebhookUseCase
    }
  };
}