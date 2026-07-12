export class DomainService {
  constructor() {
    if (this.constructor === DomainService) {
      throw new Error('DomainService is an abstract class and cannot be instantiated directly.');
    }
  }
}