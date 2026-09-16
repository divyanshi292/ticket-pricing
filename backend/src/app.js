import cors from 'cors';
import express from 'express';
import {
  bookShow,
  calculateShowPricing,
  listShows
} from './services/showStore.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'ticket-pricing-api'
  });
});

app.get('/api/shows', (_request, response) => {
  response.json({ shows: listShows() });
});

app.post('/api/pricing/calculate', (request, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return response.status(400).json({
      error: 'Request body must be a JSON object'
    });
  }

  try {
    const bill = calculateShowPricing(request.body);
    return response.json(bill);
  } catch (error) {
    return response.status(400).json({
      error: error.message
    });
  }
});

app.post('/api/bookings', (request, response) => {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return response.status(400).json({
      error: 'Request body must be a JSON object'
    });
  }

  try {
    return response.status(201).json(bookShow(request.body));
  } catch (error) {
    const status = error.message.startsWith('Show not found:') ? 404 : 400;
    return response.status(status).json({ error: error.message });
  }
});

export default app;