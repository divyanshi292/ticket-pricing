import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const TICKET_TIERS = ['Silver', 'Gold', 'Recliner'];
const EMPTY_TICKETS = Object.fromEntries(TICKET_TIERS.map((tier) => [tier, 0]));
const SAMPLE_PRICE_LIST = JSON.stringify([
  { name: 'silver', price: '₹1,500' },
  { name: 'SILVER', price: '1600' },
  { name: 'Gold', price: 'Rs. 2,500.50' },
  { name: 'Recliner', price: '' },
  { name: 'Balcony', price: '-100' }
], null, 2);

function formatPaisa(paisa) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(paisa / 100);
}

function App() {
  const [shows, setShows] = useState([]);
  const [showId, setShowId] = useState('');
  const [tickets, setTickets] = useState(EMPTY_TICKETS);
  const [isMember, setIsMember] = useState(false);
  const [bill, setBill] = useState(null);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [isLoadingShows, setIsLoadingShows] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [priceListText, setPriceListText] = useState(SAMPLE_PRICE_LIST);
  const [importReport, setImportReport] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const selectedShow = shows.find((show) => show.id === showId);
  const pricingConfig = selectedShow?.config;

  useEffect(() => {
    async function loadShows() {
      try {
        const response = await fetch('/api/shows');
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Unable to load shows');
        }
        setShows(result.shows);
        setShowId(result.shows[0]?.id || '');
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setIsLoadingShows(false);
      }
    }

    loadShows();
  }, []);

  function updateQuantity(tier, nextQuantity) {
    const maximum = pricingConfig?.tiers[tier].availableQuantity || 0;
    const quantity = Math.min(Math.max(nextQuantity, 0), maximum);
    setTickets((currentTickets) => ({ ...currentTickets, [tier]: quantity }));
    setBill(null);
    setBooking(null);
    setError('');
  }

  function selectShow(nextShowId) {
    setShowId(nextShowId);
    setTickets(EMPTY_TICKETS);
    setBill(null);
    setBooking(null);
    setError('');
  }

  async function calculateBill(event) {
    event.preventDefault();
    setIsCalculating(true);
    setError('');

    try {
      const response = await fetch('/api/pricing/calculate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ showId, tickets, isMember })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to calculate the bill');
      }

      setBill(result);
    } catch (requestError) {
      setBill(null);
      setError(requestError.message);
    } finally {
      setIsCalculating(false);
    }
  }

  async function confirmBooking() {
    setIsBooking(true);
    setError('');

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ showId, tickets, isMember })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to confirm booking');
      }

      setBooking(result);
      setBill(result.bill);
      setShows((currentShows) => currentShows.map((show) => (
        show.id === result.show.id ? result.show : show
      )));
      setTickets(EMPTY_TICKETS);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsBooking(false);
    }
  }

  async function importPrices(event) {
    event.preventDefault();
    setIsImporting(true);
    setError('');

    try {
      const prices = JSON.parse(priceListText);
      const response = await fetch('/api/pricing/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ showId, prices })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unable to import price list');
      }

      setImportReport(result);
      if (result.show) {
        setShows((currentShows) => currentShows.map((show) => (
          show.id === result.show.id ? result.show : show
        )));
        setBill(null);
        setBooking(null);
      }
    } catch (requestError) {
      setError(requestError instanceof SyntaxError
        ? 'Price list must be valid JSON'
        : requestError.message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Multiplex operations</p>
          <h1>Ticket counter</h1>
        </div>
        <div className="header-mark" aria-hidden="true">MPX / 01</div>
      </header>
      <section className="show-bar" aria-label="Show selection">
        <div className="show-copy">
          <p className="section-kicker">Now booking</p>
          <strong>{selectedShow?.movie || (isLoadingShows ? 'Loading shows...' : 'No shows available')}</strong>
          {selectedShow && (
            <span>{selectedShow.cinema} / {selectedShow.screen} / {selectedShow.showtime}</span>
          )}
        </div>
        <label className="show-select-label">
          <span>Showtime</span>
          <select value={showId} onChange={(event) => selectShow(event.target.value)} disabled={isLoadingShows}>
            {shows.map((show) => (
              <option value={show.id} key={show.id}>
                {show.screen} - {show.showtime}
              </option>
            ))}
          </select>
        </label>
      </section>
      <details className="import-panel">
        <summary>Import messy price list</summary>
        <form onSubmit={importPrices}>
          <p>Use JSON rows with a tier name and rupee price. Accepted rows update this show.</p>
          <textarea
            value={priceListText}
            onChange={(event) => setPriceListText(event.target.value)}
            aria-label="Price list JSON"
            rows="8"
          />
          <button className="import-button" type="submit" disabled={isImporting || !selectedShow}>
            {isImporting ? 'Importing...' : 'Clean and import'}
          </button>
        </form>
        {importReport && (
          <div className="import-report" role="status">
            <strong>Import report</strong>
            <div className="report-counts">
              <span>Imported {importReport.summary.imported}</span>
              <span>De-duplicated {importReport.summary.deduplicated}</span>
              <span>Rejected {importReport.summary.rejected}</span>
            </div>
            {importReport.rejected.length > 0 && (
              <ul>
                {importReport.rejected.map((item) => (
                  <li key={`${item.index}-${item.reason}`}>Row {item.index + 1}: {item.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </details>
      <div className="workspace">
        <form className="booking-panel" onSubmit={calculateBill}>
          <div className="section-heading">
            <div>
              <p className="section-kicker">01 / Selection</p>
              <h2>Choose your seats</h2>
            </div>
            <span className="availability-note">Live availability</span>
          </div>
          <div className="tier-list">
            {TICKET_TIERS.map((tier) => {
              const tierConfig = pricingConfig?.tiers[tier] || {
                pricePaisa: 0,
                available: false,
                availableQuantity: 0
              };
              const soldOut = !tierConfig.available || tierConfig.availableQuantity === 0;
              return (
                <div className={`tier-row${soldOut ? ' is-sold-out' : ''}`} key={tier}>
                  <div className="tier-info">
                    <span className="tier-name">{tier}</span>
                    <span className="tier-meta">
                      {soldOut ? 'Sold out' : `${tierConfig.availableQuantity} available`}
                    </span>
                  </div>
                  <span className="tier-price">{formatPaisa(tierConfig.pricePaisa)}</span>
                  <div className="quantity-control" aria-label={`${tier} quantity`}>
                    <button
                      type="button"
                      title={`Remove ${tier} ticket`}
                      aria-label={`Remove one ${tier} ticket`}
                      disabled={soldOut || tickets[tier] === 0}
                      onClick={() => updateQuantity(tier, tickets[tier] - 1)}
                    >
                      -
                    </button>
                    <output>{tickets[tier]}</output>
                    <button
                      type="button"
                      title={`Add ${tier} ticket`}
                      aria-label={`Add one ${tier} ticket`}
                      disabled={soldOut || tickets[tier] === tierConfig.availableQuantity}
                      onClick={() => updateQuantity(tier, tickets[tier] + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <label className="member-toggle">
            <input
              type="checkbox"
              checked={isMember}
              onChange={(event) => {
                setIsMember(event.target.checked);
                setBill(null);
              }}
            />
            <span className="toggle-copy">
              <strong>Member pricing</strong>
              <small>
                Apply {pricingConfig?.memberDiscountPercent || 0}% off, capped at{' '}
                {formatPaisa(pricingConfig?.memberDiscountCapPaisa || 0)}
              </small>
            </span>
          </label>
          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="calculate-button" type="submit" disabled={isCalculating || !selectedShow}>
            {isCalculating ? 'Calculating...' : 'Calculate bill'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <section className="bill-panel" aria-labelledby="bill-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">02 / Checkout</p>
              <h2 id="bill-title">Your bill</h2>
            </div>
            {bill && <span className="bill-status">Calculated</span>}
          </div>
          {!bill ? (
            <div className="empty-bill">
              <span className="empty-number">02</span>
              <p>Select tickets and calculate to see the full price breakdown.</p>
            </div>
          ) : (
            <div className="bill-content">
              <div className="bill-lines">
                {bill.tickets.map((line) => (
                  <div className="bill-line" key={line.tier}>
                    <span>{line.tier} <small>× {line.quantity}</small></span>
                    <strong>{formatPaisa(line.totalPaisa)}</strong>
                  </div>
                ))}
                <div className="bill-line bill-subtotal">
                  <span>Ticket subtotal</span>
                  <strong>{formatPaisa(bill.baseTicketTotalPaisa)}</strong>
                </div>
                <div className="bill-line discount-line">
                  <span>Festival discount</span>
                  <strong>- {formatPaisa(bill.festivalDiscountPaisa)}</strong>
                </div>
                <div className="bill-line discount-line">
                  <span>Member discount</span>
                  <strong>- {formatPaisa(bill.memberDiscountPaisa)}</strong>
                </div>
                <div className="bill-line">
                  <span>Convenience fee <small>× {bill.totalTickets}</small></span>
                  <strong>{formatPaisa(bill.convenienceFeePaisa)}</strong>
                </div>
                <div className="bill-line">
                  <span>GST <small>{bill.calculation.gstPercent}%</small></span>
                  <strong>{formatPaisa(bill.gstPaisa)}</strong>
                </div>
              </div>
              <div className="total-line">
                <span>Total due</span>
                <strong>{formatPaisa(bill.finalTotalPaisa)}</strong>
              </div>
              {booking ? (
                <div className="booking-confirmation" role="status">
                  <strong>Booking confirmed</strong>
                  <span>Reference {booking.bookingId}</span>
                </div>
              ) : (
                <button
                  className="confirm-button"
                  type="button"
                  onClick={confirmBooking}
                  disabled={isBooking}
                >
                  {isBooking ? 'Confirming...' : 'Confirm booking'}
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);