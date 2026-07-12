import { dequal } from 'dequal';

function deepFreeze(obj) {
  if (obj === null || typeof obj!== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;

  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = obj[prop];
    if (value && typeof value === 'object') deepFreeze(value);
  });
  return Object.freeze(obj);
}

export class ValueObject {
  constructor(props) {
    if (props === null || typeof props!== 'object') {
      throw new Error('ValueObject requires an object for props');
    }
    this.props = deepFreeze({...props });
    Object.freeze(this);
  }

  equals(other) {
    if (other === null || other === undefined) return false;
    if (!(other instanceof this.constructor)) return false;
    return dequal(this.props, other.props);
  }

  // Useful for logging/debugging
  toJSON() {
    return this.props;
  }

  // For Maps/Sets - override in subclasses for better perf
  get hashCode() {
    return JSON.stringify(this.props); // or use object-hash lib
  }
}