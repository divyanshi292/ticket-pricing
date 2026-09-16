import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import app from '../src/app.js';
let server;
let baseUrl;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json() };
}
before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
test('lists configured shows with prices and availability', async () => {
  const { response, body } = await request('/api/shows');

  assert.equal(response.status, 200);
  assert.equal(body.shows.length, 2);
  assert.equal(body.shows[0].config.tiers.Silver.availableQuantity, 40);
});
test('calculates pricing using the server-owned show configuration', async () => {
  const { response, body } = await request('/api/pricing/calculate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ showId: 'show-1', tickets: { Silver: 2 }, isMember: false })
  });

  assert.equal(response.status, 200);
  assert.equal(body.baseTicketTotalPaisa, 30000);
  assert.equal(body.finalTotalPaisa, 35105);
});

test('imports a messy price list and applies accepted prices to a show', async () => {
  const { response, body } = await request('/api/pricing/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      showId: 'show-1',
      prices: [
        { name: 'SILVER', price: '₹1,800' },
        { name: 'silver', price: '1900' },
        { name: 'Gold', price: '₹2,500.50' },
        { name: 'Recliner', price: '-1' },
        { name: 'Unknown', price: '1000' }
      ]
    })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(body.summary, { received: 5, imported: 2, deduplicated: 1, rejected: 2 });
  assert.equal(body.show.config.tiers.Silver.pricePaisa, 180000);
  assert.equal(body.show.config.tiers.Gold.pricePaisa, 250050);
});
test('confirms a booking and reduces the selected show inventory', async () => {
  const booking = await request('/api/bookings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ showId: 'show-2', tickets: { Recliner: 1 }, isMember: true })
  });

  assert.equal(booking.response.status, 201);
  assert.match(booking.body.bookingId, /^booking-/);
  assert.equal(booking.body.message, 'Booking confirmed');
  assert.equal(booking.body.show.config.tiers.Recliner.availableQuantity, 3);

  const shows = await request('/api/shows');
  const show = shows.body.shows.find((item) => item.id === 'show-2');
  assert.equal(show.config.tiers.Recliner.availableQuantity, 3);
});
test('rejects invalid bookings and unknown shows', async () => {
  const invalidQuantity = await request('/api/pricing/calculate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ showId: 'show-1', tickets: { Silver: 0 } })
  });
  assert.equal(invalidQuantity.response.status, 400);
  assert.equal(invalidQuantity.body.error, 'At least one ticket is required');

  const unknownShow = await request('/api/bookings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ showId: 'missing-show', tickets: { Silver: 1 } })
  });
  assert.equal(unknownShow.response.status, 404);
  assert.equal(unknownShow.body.error, 'Show not found: missing-show');
});