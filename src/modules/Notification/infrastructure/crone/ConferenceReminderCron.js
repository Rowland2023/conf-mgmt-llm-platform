export class ConferenceReminderCron {
    constructor({ processConferenceReminderUseCase }) {
        this.processConferenceReminderUseCase =
            processConferenceReminderUseCase;
    }

    start() {
        cron.schedule("0 * * * *", async () => {
            await this.processConferenceReminderUseCase.execute();
        });
    }
}