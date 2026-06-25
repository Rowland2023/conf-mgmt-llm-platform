export class CancelEventUseCase {
  constructor({
    eventRepository,
    outboxRepository
  }) {
    this.eventRepository = eventRepository;
    this.outboxRepository = outboxRepository;
  }

  async execute(eventId) {
    return this.eventRepository.manager.transaction(
      async (trx) => {

        const eventRepository =
          this.eventRepository.withTransaction(trx);

        const outboxRepository =
          this.outboxRepository.withTransaction(trx);

        const event =
          await eventRepository.findById(eventId);

        if (!event) {
          throw new Error("Event not found");
        }

        event.cancel();

        await eventRepository.save(event);

        await outboxRepository.save({
          type: "EventCancelled",
          aggregateId: event.id,
          payload: {
            eventId: event.id
          }
        });

        return {
          eventId: event.id,
          status: event.status
        };
      }
    );
  }
}