// src/domain/services/ConferenceReminderService.js
export class ConferenceReminderService {
  constructor({ conferenceRepository, sendEmailUseCase, sendPushNotificationUseCase }) {
    this.conferenceRepository = conferenceRepository;
    this.sendEmailUseCase = sendEmailUseCase;
    this.sendPushNotificationUseCase = sendPushNotificationUseCase;
  }

  async processUpcomingReminders() {
    const targetTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    const upcomingConferences = await this.conferenceRepository.findStartingAt(targetTime);

    for (const conference of upcomingConferences) {
      const attendees = await this.conferenceRepository.getAttendees(conference.id);

      for (const attendee of attendees) {
        const idempotencyKey = `reminder-${conference.id}-${attendee.id}-24h`;

        // Hand off to the generic use case
        await this.sendEmailUseCase.execute({
          to: attendee.email,
          templateKey: 'CONFERENCE_REMINDER',
          tenantId: conference.tenantId,
          idempotencyKey,
          templateData: {
            attendeeName: attendee.name,
            conferenceName: conference.name
          }
        });
      }
    }
  }
}