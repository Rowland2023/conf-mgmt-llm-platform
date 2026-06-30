// app.js
import express from 'express';
import eventScheduleRouter from './modules/Event Schedule/api/routes/event.routes.js'; 
import notificationRouter from './modules/Notification/api/notification.route.js';
const app = express();
app.use(express.json());

app.use('/api/events', eventScheduleRouter);
app.use('/api/notifications', notificationRouter);

// Add a root route if your test expects 'Hello World' at GET /
app.get('/', (req, res) => {
  res.status(200).send('Hello World');
});

// CRITICAL: Export the app instance!
export default app;