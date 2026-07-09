export class ProcessConferenceRemindersUseCase {
    constructor({
        conferenceRepository,
        notificationRepository,
        reminderService
    }) {
        this.conferenceRepository = conferenceRepository;
        this.notificationRepository = notificationRepository;
        this.reminderService = reminderService;
    }

    async execute() {
        const conferences =
            await this.conferenceRepository.findUpcoming();

        for (const conference of conferences) {
            const attendees =
                await this.conferenceRepository.getAttendees(conference.id);

            for (const attendee of attendees) {

                if (
                    !this.reminderService.shouldSendReminder(
                        conference
                    )
                ) {
                    continue;
                }

                const message =
                    this.reminderService.buildReminderMessage(
                        conference,
                        attendee
                    );

                const notification =
                    Notification.createReminder({
                        conferenceId: conference.id,
                        userId: attendee.id,
                        recipient: attendee.email,
                        channel: "email",
                        ...message
                    });

                await this.notificationRepository.save(notification);
            }
        }
    }
}