
export class GetEventUseCase {
    constructor({ eventRepository }) {
        this.eventRepository = eventRepository;
    }

    async execute(eventId) {
        const event = await this.eventRepository.findById(eventId);
        if (!event) {
            throw new Error("Event not found");
        }
        return event;
    }
}