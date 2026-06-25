export class EventRepository {
  async save(event) {
    throw new Error("Method save() must be implemented");
  }

  async findById(id) {
    throw new Error("Method findById() must be implemented");
  }

  async findAll() {
    throw new Error("Method findAll() must be implemented");
  }

  async delete(id) {
    throw new Error("Method delete() must be implemented");
  }

  async findConflictingEvent(roomID, startTime, endTime) {
    throw new Error("Method findConflictingEvent() must be implemented");
  }
}