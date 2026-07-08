export class EventController {

    constructor({
        createEventUseCase,
        getEventByIdUseCase,
        listEventsUseCase,
        rescheduleEventUseCase,
        cancelEventUseCase
    }) {

        this.createEventUseCase = createEventUseCase;
        this.getEventByIdUseCase = getEventByIdUseCase;
        this.listEventsUseCase = listEventsUseCase;
        this.rescheduleEventUseCase = rescheduleEventUseCase;
        this.cancelEventUseCase = cancelEventUseCase;

        this.createEvent = this.createEvent.bind(this);
        this.listEvents = this.listEvents.bind(this);
        this.getEventById = this.getEventById.bind(this);
        this.rescheduleEvent = this.rescheduleEvent.bind(this);
        this.cancelEvent = this.cancelEvent.bind(this);
    }

    async createEvent(req, res, next) {
        try {

            const result = await this.createEventUseCase.execute(req.body);

            return res.status(201).json({
                success: true,
                data: result
            });

        } catch (error) {
            next(error);
        }
    }

    async listEvents(req, res, next) {

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

        try {

            const result =
                await this.getEventByIdUseCase.execute({
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

        try {

            const result =
                await this.rescheduleEventUseCase.execute({
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

        try {

            const result =
                await this.cancelEventUseCase.execute({
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