export class Specification {
  /**
   * @param {any} candidate 
   * @returns {boolean}
   */
  isSatisfiedBy(candidate) {
    throw new Error('Method isSatisfiedBy() must be implemented');
  }

  /**
   * @param {Specification} other 
   * @returns {Specification}
   */
  and(other) {
    return new ConjunctionSpecification(this, other);
  }

  /**
   * @param {Specification} other 
   * @returns {Specification}
   */
  or(other) {
    return new DisjunctionSpecification(this, other);
  }

  /**
   * @returns {Specification}
   */
  not() {
    return new NegationSpecification(this);
  }

  /**
   * Optional: Translate to SQL WHERE clause
   * @param {string} alias 
   * @returns {string}
   */
  toSql(alias = 't') {
    throw new Error(`toSql() not implemented for ${this.constructor.name}`);
  }
}

class ConjunctionSpecification extends Specification {
  constructor(left, right) {
    super();
    this.left = left;
    this.right = right;
  }
  isSatisfiedBy(candidate) {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
  toSql(alias) {
    return `(${this.left.toSql(alias)} AND ${this.right.toSql(alias)})`;
  }
}

class DisjunctionSpecification extends Specification {
  constructor(left, right) {
    super();
    this.left = left;
    this.right = right;
  }
  isSatisfiedBy(candidate) {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
  toSql(alias) {
    return `(${this.left.toSql(alias)} OR ${this.right.toSql(alias)})`;
  }
}

class NegationSpecification extends Specification {
  constructor(spec) {
    super();
    this.spec = spec;
  }
  isSatisfiedBy(candidate) {
    return !this.spec.isSatisfiedBy(candidate);
  }
  toSql(alias) {
    return `NOT (${this.spec.toSql(alias)})`;
  }
}