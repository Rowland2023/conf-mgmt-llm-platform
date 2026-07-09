export class GoogleCalendarGateway {

    constructor({ apiKey }) {
        this.apiKey = apiKey;
    }

    async createEvent(event) {
        console.log("Google Calendar -> create event");

        return {
            provider: "google",
            externalId: crypto.randomUUID()
        };
    }

    async updateEvent(event) {
        console.log("Google Calendar -> update event");
    }

    async deleteEvent(externalId) {
        console.log("Google Calendar -> delete event");
    }
}