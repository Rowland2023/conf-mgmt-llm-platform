import { DomainValidationError } from '../errors/DomainErrors.js';

export class Entity {
  /**
   * @param {string} id - The unique identifier of the entity
   */
  constructor(id) {
    if (!id || typeof id!== 'string' || id.trim() === '') {
      throw new DomainValidationError('Entity must have a non-empty string ID');
    }
    this._id = id.trim();
  }

  get id() {
    return this._id;
  }

  /**
   * Entities are compared by identity: same type + same ID.
   * @param {Entity} [other]
   * @returns {boolean}
   */
  equals(other) {
    if (other === null || other === undefined) return false;
    if (this.constructor!== other.constructor) return false;
    return this.id === other.id;
  }

  /**
   * For use in Maps/Sets or custom collections.
   */
  hashCode() {
    return `${this.constructor.name}:${this.id}`;
  }

  toString() {
    return `${this.constructor.name}(id=${this.id})`;
  }
}