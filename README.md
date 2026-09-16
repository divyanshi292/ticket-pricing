# Multiplex Ticket Pricing Engine

React and Express assessment project for multiplex ticket pricing, show availability,
booking confirmation, and messy price-list import.

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Run locally

Install all workspace dependencies:

```bash
npm install
```

Start the React frontend and Express backend together:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/api` requests to the backend at `http://localhost:3001`.

Verify the backend directly:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{"status":"ok","service":"ticket-pricing-api"}
```

Create a production frontend build with:

```bash
npm run build
```

Run the backend tests with:

```bash
npm test
```

## Debugging

Run the frontend and backend separately when isolating a problem:

```bash
npm run dev --workspace backend
npm run dev --workspace frontend
```

Check that the backend is responding:

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/shows
```

If a port is already in use, find the process and stop the old development server:

```bash
lsof -nP -iTCP:5173 -iTCP:3001 -sTCP:LISTEN
kill <PID>
```

The Vite frontend proxies `/api` to port `3001`. If the page is blank, check the browser
console for a frontend runtime error, hard-refresh after restarting Vite, and confirm the
backend is running. If inventory appears reset, that is expected: the current no-database
store is in memory and resets when the backend restarts.

## Public GitHub submission

The repository must be public on GitHub for evaluation. From the project root, create a
public repository on GitHub, then connect and push this repository:

```bash
git add .
git commit -m "Build multiplex ticket pricing engine"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git
git push -u origin main
```

Confirm the repository visibility is set to **Public** in GitHub repository settings.

## Pricing service

The backend pricing engine is a pure module at `backend/src/services/pricingService.js`.
It accepts ticket prices and availability in paise, for example:

```js
const bill = calculatePricing({
	tickets: { Silver: 2, Gold: 1 },
	isMember: true,
	config: {
		tiers: {
			Silver: { pricePaisa: 15000, available: true },
			Gold: { pricePaisa: 25000, available: true },
			Recliner: { pricePaisa: 40000, available: false }
		},
		festivalDiscountPaisa: 500,
		memberDiscountPercent: 10,
		memberDiscountCapPaisa: 1000,
		convenienceFeePaisaPerTicket: 125,
		gstPercent: 18
	}
});
```

The calculation order is base ticket total, festival discount, capped member discount,
convenience fee, and GST on the discounted tickets plus fee. All monetary values in the
service are integer paisa, and percentage results are rounded to the nearest paisa. A tier
can also provide `availableQuantity` to reject bookings above its remaining inventory.

## Booking API

The backend owns the show catalog and pricing configuration:

```http
GET /api/shows
POST /api/pricing/calculate
POST /api/bookings
```

Calculation and booking requests use a show ID and ticket quantities:

```json
{
	"showId": "show-1",
	"tickets": { "Silver": 2, "Gold": 1 },
	"isMember": true
}
```

`POST /api/bookings` recalculates against current inventory, confirms the booking,
returns the bill and booking reference, and reduces the in-memory availability. The
current store is intentionally in memory because this assessment has no database yet;
restarting the backend resets the sample shows.

## Messy price-list import

Use `POST /api/pricing/import` with a `showId` and a `prices` array. Prices are treated
as rupee amounts and may use commas, currency prefixes, and up to two decimal places:

```json
{
	"showId": "show-1",
	"prices": [
		{ "name": " silver ", "price": "₹1,500.50" },
		{ "tier": "SILVER", "amount": "1600" },
		{ "class": "Gold", "price": "Rs. 2,500" },
		{ "name": "Recliner", "price": "" },
		{ "name": "Balcony", "price": "-100" }
	]
}
```

The response reports `imported`, `deduplicated`, and `rejected` rows. Tier names are
canonicalized case-insensitively to Silver, Gold, and Recliner. The first valid row for
a tier is kept; blank, negative, unknown, and malformed prices are rejected with row
indexes and reasons. Accepted prices are returned in paise and applied to the selected
show.
