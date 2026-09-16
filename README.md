# Multiplex Ticket Pricing Engine

Starter project for the assessment application.

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

Booking UI and API endpoints are intentionally not implemented yet.

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
