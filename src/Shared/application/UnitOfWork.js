export class UnitOfWork {
  constructor(transactionManager, eventOutboxRepo) {
    this.transactionManager = transactionManager;
    this.eventOutboxRepo = eventOutboxRepo; // not eventBus
    this.trackedAggregates = [];
  }

  track(aggregate) {
    if (!this.trackedAggregates.some(a => a.id === aggregate.id)) { // use id, not equals
      this.trackedAggregates.push(aggregate);
    }
  }

  async complete(work) {
    return this.transactionManager.runInTransaction(async (txCtx) => {
      // 1. Run business logic + repo.save() calls
      const result = await work(txCtx);

      // 2. Collect events from aggregates
      const events = this.trackedAggregates.flatMap(a => a.getDomainEvents());
      
      // 3. Write events to outbox table IN SAME TRANSACTION
      if (events.length > 0) {
        await this.eventOutboxRepo.save(events, txCtx); 
      }

      // 4. Clear events from aggregates 
      this.trackedAggregates.forEach(a => a.clearDomainEvents());
      this.trackedAggregates = [];

      return result; // COMMIT happens here
    });
    // 5. A separate worker process reads outbox table and publishes to eventBus
    //    If publish fails, row stays in outbox for retry. No data loss.
  }
}