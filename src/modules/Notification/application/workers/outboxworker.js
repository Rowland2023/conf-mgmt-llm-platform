export class OutboxWorker {
    constructor({
        outboxRepository,
        notificationRepository,
        dispatcher
    }) {
        this.outboxRepository = outboxRepository;
        this.notificationRepository = notificationRepository;
        this.dispatcher = dispatcher;
    }

    async process() {
        const events = await this.outboxRepository.fetchPending();

        for (const event of events) {
            const notification =
                await this.notificationRepository.findById(
                    event.aggregateId
                );

            if (!notification) {
                continue;
            }

            await this.dispatcher.dispatch(notification);

            await this.outboxRepository.markAsDispatched(event.id);
        }
    }
}