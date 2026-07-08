import {
    ConflictError,
    ValidationError
} from '../../../shared/errors/ApplicationErrors.js';

export class CreateEventUseCase {
    constructor({
        eventRepository,
        outboxRepository,
        calendarSynchronizationService,
        logger,
        metrics
    }) {
        this.eventRepository = eventRepository;
        this.outboxRepository = outboxRepository;
        this.calendarSynchronizationService = calendarSynchronizationService;
        this.logger = logger;
        this.metrics = metrics;
    }

    async execute(command) {

        const {
            title,
            roomId,
            startTime,
            endTime
        } = command;

        if (!title || !roomId || !startTime || !endTime) {
            throw new ValidationError('Missing required event information.');
        }

        return this.eventRepository.transaction(async (trx) => {

            const hasConflict =
                await this.eventRepository.existsOverlappingEvent(
                    {
                        roomId,
                        startTime,
                        endTime,
                        trx
                    }
                );

            if (hasConflict) {
                throw new ConflictError(
                    'Room already has a scheduled event.'
                );
            }

            const event = await this.eventRepository.create(
                {
                    title,
                    roomId,
                    startTime,
                    endTime
                },
                trx
            );

            await this.outboxRepository.add(
                {
                    eventType: 'EventCreated',
                    aggregateId: event.id,
                    payload: {
                        eventId: event.id,
                        title: event.title,
                        roomId: event.roomId,
                        startTime: event.startTime,
                        endTime: event.endTime
                    }
                },
                trx
            );

            this.logger?.info('EVENT_CREATED', {
                eventId: event.id
            });

            this.metrics?.increment('event.created');

            //
            // Optional:
            // Only if you want synchronous calendar creation.
            // Otherwise your Outbox Worker should perform this.
            //
            // await this.calendarSynchronizationService.createEvent(event);

            return {
                eventId: event.id
            };
        });
    }
}