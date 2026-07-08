import {
    NotFoundError,
    ValidationError
} from '../../../shared/errors/ApplicationErrors.js';

export class GetEventByIdUseCase {
    constructor({
        eventRepository,
        logger,
        metrics
    }) {
        this.eventRepository = eventRepository;
        this.logger = logger;
        this.metrics = metrics;
    }

    async execute({ eventId }) {

        if (!eventId) {
            throw new ValidationError('Event ID is required.');
        }

        const event = await this.eventRepository.findById(eventId);

        if (!event) {
            throw new NotFoundError('Event not found.');
        }

        this.logger?.info('EVENT_FETCHED', {
            eventId
        });

        this.metrics?.increment('event.fetched');

        return event;
    }
}