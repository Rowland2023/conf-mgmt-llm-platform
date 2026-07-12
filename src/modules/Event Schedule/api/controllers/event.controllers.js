export class EventController {
    /**
     * @param {Object} deps
     * @param {import('../../ports/ILogger.js').ILogger} deps.logger
     */
    constructor({
        createEventUseCase,
        getEventByIdUseCase,
        listEventsUseCase,
        rescheduleEventUseCase,
        cancelEventUseCase,
        logger // Injected interface port
    }) {
        this.createEventUseCase = createEventUseCase;
        this.getEventByIdUseCase = getEventByIdUseCase;
        this.listEventsUseCase = listEventsUseCase;
        this.rescheduleEventUseCase = rescheduleEventUseCase;
        this.cancelEventUseCase = cancelEventUseCase;
        
        // Scope the logger to this specific controller context
        this.logger = logger.child({ context: "EventController" });

        this.createEvent = this.createEvent.bind(this);
        this.listEvents = this.listEvents.bind(this);
        this.getEventById = this.getEventById.bind(this);
        this.rescheduleEvent = this.rescheduleEvent.bind(this);
        this.cancelEvent = this.cancelEvent.bind(this);
    }

    async createEvent(req, res, next) {
        this.logger.info("HTTP request received: Create Event");
        try {
            const result = await this.createEventUseCase.execute(req.body);

            this.logger.debug("HTTP response generated: 201 Created");
            return res.status(201).json({
                success: true,
                data: result
            });
        } catch (error) {
            // We do NOT use logger.error() here because your 
            // TelemetryUseCaseDecorator is already logging the full exception!
            next(error);
        }
    }

    async listEvents(req, res, next) {
        this.logger.info("HTTP request received: List Events");
        try {
            const result = await this.listEventsUseCase.execute(req.query);

            return res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async getEventById(req, res, next) {
        this.logger.info("HTTP request received: Get Event By ID", { eventId: req.params.id });
        try {
            const result = await this.getEventByIdUseCase.execute({
                eventId: req.params.id
            });

            return res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async rescheduleEvent(req, res, next) {
        this.logger.info("HTTP request received: Reschedule Event", { eventId: req.params.id });
        try {
            const result = await this.rescheduleEventUseCase.execute({
                eventId: req.params.id,
                ...req.body
            });

            return res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    async cancelEvent(req, res, next) {
        this.logger.info("HTTP request received: Cancel Event", { eventId: req.params.id });
        try {
            const result = await this.cancelEventUseCase.execute({
                eventId: req.params.id
            });

            return res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}