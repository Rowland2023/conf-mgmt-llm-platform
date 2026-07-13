// shared/domain/AggregateRoot.js

import { Entity } from "./Entity.js";

export class AggregateRoot extends Entity {
    constructor(id) {
        super(id);
        this._domainEvents = [];
    }

    addDomainEvent(event) {
        this._domainEvents.push(event);
    }

    pullDomainEvents() {
        const events = [...this._domainEvents];
        this._domainEvents.length = 0;
        return events;
    }

    clearDomainEvents() {
        this._domainEvents.length = 0;
    }

    get domainEvents() {
        return [...this._domainEvents];
    }
}