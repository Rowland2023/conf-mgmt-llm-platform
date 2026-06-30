import postgres from '../database/postgres.client.js';

export const userRepository = {
  async createUserWithOutbox(user, outbox) {
    const client = await postgres.getClient();
    try {
      await client.query('BEGIN');

      const userSql = 'INSERT INTO users (id, email) VALUES ($1, $2)';
      await client.query(userSql, [user.id, user.email]);

      const outboxSql = 'INSERT INTO outbox (id, aggregate_type, payload) VALUES ($1, $2, $3)';
      await client.query(outboxSql, [outbox.id, 'User', JSON.stringify(outbox.payload)]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async updateUserWithOutbox(user, outbox) {
    const client = await postgres.getClient();
    try {
      await client.query('BEGIN');

      const updateSql = 'UPDATE users SET email = $1 WHERE id = $2';
      await client.query(updateSql, [user.email, user.id]);

      const outboxSql = 'INSERT INTO outbox (id, aggregate_type, payload) VALUES ($1, $2, $3)';
      await client.query(outboxSql, [outbox.id, 'UserUpdated', JSON.stringify(outbox.payload)]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};
