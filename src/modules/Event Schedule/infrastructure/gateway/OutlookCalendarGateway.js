export class OutlookCalendarGateway {

    constructor({ clientId, clientSecret }) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    async createEvent(event) {
        console.log("Outlook Calendar -> create event");

        return {
            provider: "outlook",
            externalId: crypto.randomUUID()
        };
    }

    async updateEvent(event) {
        console.log("Outlook Calendar -> update event");
    }

    async deleteEvent(externalId) {
        console.log("Outlook Calendar -> delete event");
    }
}