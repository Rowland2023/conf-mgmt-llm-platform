// app.js
import express from 'express';
import eventScheduleRouter from './src/modules/Event Schedule/api/routes/event.routes.js'; 

const app = express();
app.use(express.json());

app.use('/api/events', eventScheduleRouter);

// Add a root route if your test expects 'Hello World' at GET /
app.get('/', (req, res) => {
  res.status(200).send('Hello World');
});

// CRITICAL: Export the app instance!
export default app;