
export class ResheduleEventUseCase {
    constructor({ eventRepository,outboxRepository }) {
        this.eventRepository = eventRepository;
        this.outboxRepository = outboxRepository;
    }   

    async execute({command}) {

        return await this.eventRepository.manager.transaction(async (trx) => {
            const event = await this.eventRepository.findById(eventId);
            if (!event) {
                throw new Error("Event not found");
            }
            const hasConflict= await this.eventRepository.existsOverlapping(roomId, startTime, endTime, eventId);
            if (hasConflict) {
                throw new Error("Scheduling conflict detected");
            }
            event.reschedule(newStartTime, newEndTime);
            await trx.save(event);

            await trx.save({
                eventId: event.id,
                roomId:event.roomId,
                startTime:newStartTime,
                endTime:newEndTime,
                processed: false});    
            await trx.save(outbox_entity);
            return event;
        });
    }
}