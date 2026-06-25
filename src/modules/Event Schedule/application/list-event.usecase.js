
export class ListEventUseCase {
    constructor({ eventRepository }) {
        this.eventRepository = eventRepository;
    }

    async execute(filters) {
        const events = await this.eventRepository.findAll(filters);

        return events;
    }
}