import { ValidationError } from "../../domain/errors/PaymentErrors.js";
import { GetAllPaymentsQuery } from "../../domain/queries/GetAllPaymentsQuery.js";

const ALLOWED_SORT_FIELDS = new Set([
    "createdAt",
    "updatedAt",
    "amount",
    "status",
    "currency"
]);

const ALLOWED_SORT_DIRECTIONS = new Set([
    "asc",
    "desc"
]);

export class GetAllPaymentsUseCase {
    constructor({
        paymentRepository,
        logger = console,
        metrics
    }) {
        if (!paymentRepository) {
            throw new Error("GetAllPaymentsUseCase requires paymentRepository.");
        }

        this.paymentRepository = paymentRepository;
        this.logger = logger;
        this.metrics = metrics;
    }

    async execute(input) {
        const startedAt = Date.now();
        const query = new GetAllPaymentsQuery(input);
        
        // Resolve security boundaries explicitly
        const tenantContext = this.#resolveTenantContext(query);

        // Limit maximum batch sizing defensively to prevent memory saturation crashes
        const requestedLimit = Math.min(query.limit ?? 25, 100);
        const page = Math.max(query.page ?? 1, 1);
        
        // Calculate the raw database offset using the actual intended page size,
        // preventing the "limit + 1" trick from messing up downstream database math.
        const offset = (page - 1) * requestedLimit;

        const criteria = {
            ...tenantContext, // Merges either { tenantId } or { isGlobalAdminQuery: true }
            status: query.status,
            bookingId: query.bookingId,
            email: query.email,
            gateway: query.gateway,
            currency: query.currency,
            offset, 
            limit: requestedLimit + 1, // Lookahead padding for hasNext calculation
            sortBy: this.#normalizeSortField(query.sortBy),
            sortDirection: this.#normalizeSortDirection(query.sortDirection)
        };

        this.logger.info?.(
            { tenantId: criteria.tenantId, page, limit: requestedLimit, status: criteria.status },
            "Listing payments."
        );

        // Execute a fast, single query instead of running two separate lookups
        const payments = await this.paymentRepository.findMany(criteria);

        // Evaluate if a next page exists based on the extra element presence
        const hasNext = payments.length > requestedLimit;
        
        // Trim your array back down to what the client actually requested
        if (hasNext) {
            payments.pop();
        }

        this.metrics?.increment?.("payment.list.request");
        this.metrics?.histogram?.("payment.list.duration", Date.now() - startedAt);

        return {
            items: payments.map(payment => payment.toResponse()),
            pagination: {
                page,
                limit: requestedLimit,
                hasNext,
                hasPrevious: page > 1
            }
        };
    }

    #resolveTenantContext(query) {
        if (!query.currentUser) {
            throw new ValidationError("Authenticated user context is required.");
        }

        // Global Platform Administrators handling cross-tenant dashboards
        if (query.currentUser.role === "admin") {
            if (query.tenantId) {
                return { tenantId: query.tenantId };
            }
            // Explicitly flag cross-tenant querying so your repository tier 
            // doesn't accidentally drop the multi-tenant where clause by mistake.
            return { isGlobalAdminQuery: true };
        }

        // Standard Tenant Isolation boundaries
        if (!query.currentUser.tenantId) {
            throw new ValidationError("Authenticated user is not associated with a tenant.");
        }

        return { tenantId: query.currentUser.tenantId };
    }

    #normalizeSortField(sortBy) {
        if (!sortBy) return "createdAt";
        if (!ALLOWED_SORT_FIELDS.has(sortBy)) {
            throw new ValidationError(`Unsupported sort field '${sortBy}'.`);
        }
        return sortBy;
    }

    #normalizeSortDirection(direction) {
        if (!direction) return "desc";
        const normalized = direction.toLowerCase();
        if (!ALLOWED_SORT_DIRECTIONS.has(normalized)) {
            throw new ValidationError(`Unsupported sort direction '${direction}'.`);
        }
        return normalized;
    }
}