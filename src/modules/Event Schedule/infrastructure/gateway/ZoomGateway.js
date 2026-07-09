export class ZoomGateway {

    constructor({
        accountId,
        clientId,
        clientSecret
    }) {
        this.accountId = accountId;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    async createMeeting(event) {

        console.log("Zoom -> create meeting");

        return {
            provider: "zoom",
            meetingId: crypto.randomUUID(),
            joinUrl: "https://zoom.us/j/example"
        };
    }

    async updateMeeting(meetingId, event) {
        console.log("Zoom -> update meeting");
    }

    async deleteMeeting(meetingId) {
        console.log("Zoom -> delete meeting");
    }
}