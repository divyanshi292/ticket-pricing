# Solution Reasoning

## Goal

The application models a multiplex counter that must calculate a trustworthy bill for
different ticket tiers while rejecting unavailable or malformed input. The implementation
keeps pricing rules independent from HTTP and React so the financial behavior can be tested
without starting a server or browser.

## Architecture

- `backend/src/services/pricingService.js` contains the pure pricing calculation.
- `backend/src/services/showStore.js` owns the in-memory show catalog and availability.
- `backend/src/services/priceListImportService.js` cleans and reports messy price lists.
- `backend/src/app.js` exposes the HTTP API without owning pricing rules.
- `frontend/src/main.jsx` loads show data, submits user input, and renders server responses.
- `backend/test` contains unit tests for pricing/import logic and API integration tests.

## Money and rounding

All money values inside the backend are integer paise. This avoids binary floating-point
errors when adding ticket totals, fees, discounts, and GST. Input prices from the messy
price-list importer are treated as rupees and converted to paise using string parsing.

Percentage calculations use nearest-paisa, half-up rounding. The calculation order is:

1. Calculate the ticket subtotal.
2. Apply the flat festival discount, capped at the subtotal.
3. Apply the member percentage discount to the reduced subtotal.
4. Apply the member discount cap.
5. Add the per-ticket convenience fee.
6. Calculate GST on the discounted ticket total plus convenience fee.

The returned bill includes each intermediate value so the counter can show a clear,
line-by-line explanation instead of only returning a final number.

## Availability and booking

Each show has independent prices and `availableQuantity` values for Silver, Gold, and
Recliner. Calculation validates requested quantities against the current show. Booking
recalculates immediately before reducing inventory, which prevents a stale bill from being
confirmed after availability changes within this process.

The current store is intentionally in memory because the assessment does not require a
database. Restarting the backend resets the sample catalog. A production version would
move show data and inventory updates into a database transaction.

## Messy price-list import

The importer canonicalizes tier names case-insensitively and accepts rows using `name`,
`tier`, or `class`. It accepts rupee values with optional `₹`, `Rs`, or `INR` prefixes,
commas, whitespace, and up to two decimal places.

The first valid row for a canonical tier wins. Later valid rows for that tier are reported
as de-duplicated rather than silently replacing the earlier value. Blank prices, negative
prices, unknown tiers, malformed values, and malformed rows are reported as rejected with
their input index and reason. Accepted values can be applied to a selected show through
`POST /api/pricing/import`.

## Testing strategy

The tests focus on business behavior rather than implementation details. They cover single
and multiple tiers, discounts individually and together, caps, fees, GST, exact-paisa
rounding, invalid quantities, sold-out tiers, insufficient inventory, messy imports, API
validation, and booking inventory updates.