// src/infrastructure/cron/ConferenceReminderCron.js
import cron from 'node-cron';

export class ConferenceReminderCron {
  constructor({ conferenceReminderService }) {
    this.conferenceReminderService = conferenceReminderService;
  }

  start() {
    // Runs every hour on the hour (0 * * * *)
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ Triggering scheduled conference reminders...');
      await this.conferenceReminderService.processUpcomingReminders();
    });
  }
}