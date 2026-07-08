export class OutboxRepository {
  async save(event, trx) {
    throw new Error('OutboxRepository.save() must be implemented.');
  }

  async fetchPending(limit = 100, trx) {
    throw new Error('OutboxRepository.fetchPending() must be implemented.');
  }

  async markAsProcessed(id, trx) {
    throw new Error('OutboxRepository.markAsProcessed() must be implemented.');
  }

  async markAsFailed(id, reason, nextRetryAt, trx) {
    throw new Error('OutboxRepository.markAsFailed() must be implemented.');
  }

  async deleteProcessed(beforeDate, trx) {
    throw new Error('OutboxRepository.deleteProcessed() must be implemented.');
  }
}