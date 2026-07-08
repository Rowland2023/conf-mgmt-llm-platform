// src/modules/event-schedule/application/use-cases/RescheduleEventUseCase.js

import {
  NotFoundError,
  ConflictError
} from '../../../../shared/errors/ApplicationErrors.js';

export class RescheduleEventUseCase {
  constructor({
    eventRepository,
    outboxRepository,
    unitOfWork
  }) {
    this.eventRepository = eventRepository;
    this.outboxRepository = outboxRepository;
    this.unitOfWork = unitOfWork;
  }

  async execute({
    eventId,
    roomId,
    newStartTime,
    newEndTime
  }) {
    return this.unitOfWork.transaction(async (tx) => {
      // Load aggregate
      const event = await this.eventRepository.findById(eventId, tx);

      if (!event) {
        throw new NotFoundError('Event not found.');
      }

      // Validate scheduling conflict
      const hasConflict =
        await this.eventRepository.existsOverlapping(
          roomId,
          newStartTime,
          newEndTime,
          eventId,
          tx
        );

      if (hasConflict) {
        throw new ConflictError(
          'Scheduling conflict detected for the selected room.'
        );
      }

      // Execute domain behavior
      event.reschedule({
        roomId,
        startTime: newStartTime,
        endTime: newEndTime
      });

      // Persist aggregate
      await this.eventRepository.save(event, tx);

      // Publish through Transactional Outbox
      await this.outboxRepository.save(
        {
          aggregateId: event.id,
          aggregateType: 'Event',
          eventType: 'EventRescheduled',
          payload: {
            eventId: event.id,
            roomId: event.roomId,
            startTime: event.startTime,
            endTime: event.endTime
          }
        },
        tx
      );

      return event;
    });
  }
}