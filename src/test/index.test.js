// src/index.test.js
import request from 'supertest';
// Clear out curly braces if they are there. It should look like this:
import app from '../app.module.js'; 

test('GET / responds with Hello World', async () => {
   const res = await request(app).get('/');
   expect(res.statusCode).toBe(200);
   expect(res.text).toBe('Hello World');
});