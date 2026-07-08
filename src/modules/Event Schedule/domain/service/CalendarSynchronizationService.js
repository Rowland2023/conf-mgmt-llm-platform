// src/modules/Event Schedule/domain/service/CalendarSynchronizationService.js

export class CalendarSynchronizationService {
    constructor({
        googleCalendarGateway,
        outlookCalendarGateway,
        zoomGateway,
        logger = console
    }) {
        this.googleCalendar = googleCalendarGateway;
        this.outlookCalendar = outlookCalendarGateway;
        this.zoom = zoomGateway;
        this.logger = logger;
    }

    /**
     * Synchronize a newly created conference event
     */
    async createEvent(event) {

        const results = {};

        // Google Calendar
        if (this.googleCalendar) {
            try {
                results.google =
                    await this.googleCalendar.createEvent(event);
            } catch (error) {
                this.logger.error(error);
            }
        }

        // Outlook Calendar
        if (this.outlookCalendar) {
            try {
                results.outlook =
                    await this.outlookCalendar.createEvent(event);
            } catch (error) {
                this.logger.error(error);
            }
        }

        // Zoom Meeting
        if (this.zoom) {
            try {
                results.zoom =
                    await this.zoom.createMeeting(event);
            } catch (error) {
                this.logger.error(error);
            }
        }

        return results;
    }

    /**
     * Synchronize event updates
     */
    async updateEvent(event) {

        const results = {};

        if (this.googleCalendar) {
            try {
                results.google =
                    await this.googleCalendar.updateEvent(event);
            } catch (error) {
                this.logger.error(error);
            }
        }

        if (this.outlookCalendar) {
            try {
                results.outlook =
                    await this.outlookCalendar.updateEvent(event);
            } catch (error) {
                this.logger.error(error);
            }
        }

        if (this.zoom) {
            try {
                results.zoom =
                    await this.zoom.updateMeeting(
                        event.zoomMeetingId,
                        event
                    );
            } catch (error) {
                this.logger.error(error);
            }
        }

        return results;
    }

    /**
     * Delete event everywhere
     */
    async deleteEvent(event) {

        if (this.googleCalendar && event.googleCalendarId) {
            try {
                await this.googleCalendar.deleteEvent(
                    event.googleCalendarId
                );
            } catch (error) {
                this.logger.error(error);
            }
        }

        if (this.outlookCalendar && event.outlookCalendarId) {
            try {
                await this.outlookCalendar.deleteEvent(
                    event.outlookCalendarId
                );
            } catch (error) {
                this.logger.error(error);
            }
        }

        if (this.zoom && event.zoomMeetingId) {
            try {
                await this.zoom.deleteMeeting(
                    event.zoomMeetingId
                );
            } catch (error) {
                this.logger.error(error);
            }
        }
    }
}