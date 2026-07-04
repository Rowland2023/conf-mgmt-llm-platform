import { ValidationError } from "../../domain/errors/PaymentErrors.js";

// Define a strict whitelist for statuses
const VALID_STATUSES = new Set(['PENDING', 'GATEWAY_INITIALIZED', 'SUCCESSFUL', 'FAILED', 'REFUNDED']);

export class GetAllPaymentsUseCase {
  constructor({ paymentRepository, logger }) {
    this.paymentRepository = paymentRepository;
    this.logger = logger;
  }

  async execute(command) {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      tenantId, 
      currentUser 
    } = command;

    // 1. Strict Authentication/Authorization Boundary Guard
    if (!currentUser) {
      throw new ValidationError("Unauthorized: Missing user context.");
    }

    // Determine target tenant safely
    let targetTenantId;
    if (currentUser.role === 'admin') {
      // Admins can scope down to a tenant, or fetch everything if tenantId is omitted
      targetTenantId = tenantId; 
    } else {
      // Regular users are tightly locked to their own tenant. No exceptions.
      if (!currentUser.tenantId) {
        throw new ValidationError("Access Denied: User context does not belong to a valid tenant.");
      }
      targetTenantId = currentUser.tenantId;
    }

    // 2. Filter Sanitation & Validation
    if (status && !VALID_STATUSES.has(status)) {
      throw new ValidationError(`Invalid query parameter: status '${status}' is not recognized.`);
    }

    // 3. Bulletproof Number Parsing Guardrails
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const sanitizedPage = Number.isNaN(parsedPage) ? 1 : Math.max(1, parsedPage);
    const sanitizedLimit = Number.isNaN(parsedLimit) ? 20 : Math.max(1, Math.min(100, parsedLimit));
    
    const offset = (sanitizedPage - 1) * sanitizedLimit;

    // Construct the strictly scrubbed criteria object
    const filterCriteria = {
      ...(status && { status }),
      ...(targetTenantId && { tenantId: targetTenantId }) 
    };

    try {
      // 4. Parallel Execution
      const [paymentEntities, totalCount] = await Promise.all([
        this.paymentRepository.findMany(filterCriteria, { limit: sanitizedLimit, offset }),
        this.paymentRepository.count(filterCriteria)
      ]);

      // 5. Decouple storage schema from outward-facing representation
      const serializedPayments = paymentEntities.map(payment => payment.toResponse());

      return {
        data: serializedPayments,
        pagination: {
          total: totalCount,
          page: sanitizedPage,
          limit: sanitizedLimit,
          totalPages: Math.ceil(totalCount / sanitizedLimit)
        }
      };

    } catch (dbError) {
      // Log metadata carefully—never log raw sensitive user data
      this.logger.error("Database extraction failure during execution of GetAllPayments.", {
        hasStatusFilter: !!status,
        targetTenantId,
        error: dbError.message
      });
      
      // Masking raw DB driver strings from leaking infrastructure details to the client
      throw new Error("Internal system exception occurred during ledger collection retrieval.");
    }
  }
}