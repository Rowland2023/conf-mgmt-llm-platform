export class EventRepository {
  constructor() {
    if (new.target === EventRepository) {
      throw new Error("EventRepository is abstract.");
    }
  }

  async save(event) {
    throw new Error("Method save() must be implemented.");
  }

  async findById(id) {
    throw new Error("Method findById() must be implemented.");
  }

  async findMany(criteria = {}) {
    throw new Error("Method findMany() must be implemented.");
  }

  async remove(id) {
    throw new Error("Method remove() must be implemented.");
  }

  async findConflictingEvent({
    roomId,
    startTime,
    endTime,
    excludeEventId = null
  }) {
    throw new Error("Method findConflictingEvent() must be implemented.");
  }
}