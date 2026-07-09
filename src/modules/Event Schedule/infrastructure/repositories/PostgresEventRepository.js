import { Event } from "../../domain/entities/event.js";

export class ConcurrencyError extends Error {
  constructor(msg) { 
    super(msg); 
    this.name = 'ConcurrencyError'; 
  }
}

export class DuplicateKeyError extends Error {
  constructor(msg) { 
    super(msg); 
    this.name = 'DuplicateKeyError'; 
  }
}

export class PostgresEventRepository {
  /**
   * @param {import('pg').PoolClient | import('pg').Pool} client 
   * Expects an active transaction context (PoolClient) for write methods
   */
  constructor(client) {
    if (!client || typeof client.query !== 'function') {
      throw new Error('PostgresEventRepository requires a valid pg client or pool instance.');
    }
    this.client = client;
  }

  async findById(id) {
    const { rows, rowCount } = await this.client.query(
      `SELECT id, title, room_id, start_time, end_time, status, version 
       FROM events WHERE id = $1`,
      [id]
    );
    return rowCount === 0 ? null : this.toDomain(rows[0]);
  }

  async findByIdForUpdate(id) {
    const { rows, rowCount } = await this.client.query(
      `SELECT id, title, room_id, start_time, end_time, status, version 
       FROM events WHERE id = $1 FOR UPDATE`,
      [id]
    );
    return rowCount === 0 ? null : this.toDomain(rows[0]);
  }

  /**
   * Inserts a new aggregate root. 
   * Enforces transaction safety by matching unique constraint violations.
   */
  async insert(event) {
    try {
      const { rows } = await this.client.query(
        `
        INSERT INTO events 
          (id, title, room_id, start_time, end_time, status, version)
        VALUES ($1, $2, $3, $4, $5, $6, 0)
        RETURNING version
        `,
        [event.id, event.title, event.roomId, event.startTime, event.endTime, event.status]
      );
      
      event.version = rows[0].version;
      return event;
    } catch (error) {
      // Postgres error code 23505 = unique_violation
      if (error.code === '23505') {
        throw new DuplicateKeyError(`Event with id ${event.id} already exists.`);
      }
      throw error;
    }
  }

  /**
   * Updates an existing aggregate root using Optimistic Concurrency Control.
   */
  async update(event) {
    const { rows, rowCount } = await this.client.query(
      `
      UPDATE events SET
        title = $2, 
        room_id = $3, 
        start_time = $4,
        end_time = $5, 
        status = $6,
        version = version + 1, 
        updated_at = NOW()
      WHERE id = $1 AND version = $7
      RETURNING version
      `,
      [
        event.id, event.title, event.roomId, event.startTime,
        event.endTime, event.status, event.version,
      ]
    );

    if (rowCount === 0) {
      throw new ConcurrencyError(`Event with id ${event.id} was modified concurrently or does not exist. Retry transaction.`);
    }

    event.version = parseInt(rows[0].version, 10);
    return event;
  }

  /**
   * Mapping Layer: Marshals database layout cleanly into Domain Entities.
   */
  toDomain(row) {
    return new Event({
      id: row.id,
      title: row.title,
      roomId: row.room_id,
      // Date instances are instantiated safely, ensuring timezone consistency
      startTime: row.start_time instanceof Date ? row.start_time : new Date(row.start_time),
      endTime: row.end_time instanceof Date ? row.end_time : new Date(row.end_time),
      status: row.status,
      version: parseInt(row.version, 10),
    });
  }
}