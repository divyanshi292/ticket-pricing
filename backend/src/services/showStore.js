import { calculatePricing, TICKET_TIERS } from './pricingService.js';

const shows = new Map([
  ['show-1', {
    id: 'show-1',
    movie: 'Friday Night at the Multiplex',
    cinema: 'Central Square Multiplex',
    screen: 'Screen 1',
    showtime: 'Tonight, 7:30 PM',
    config: {
      tiers: {
        Silver: { pricePaisa: 15000, available: true, availableQuantity: 40 },
        Gold: { pricePaisa: 25000, available: true, availableQuantity: 24 },
        Recliner: { pricePaisa: 40000, available: true, availableQuantity: 8 }
      },
      festivalDiscountPaisa: 500,
      memberDiscountPercent: 10,
      memberDiscountCapPaisa: 1000,
      convenienceFeePaisaPerTicket: 125,
      gstPercent: 18
    }
  }],
  ['show-2', {
    id: 'show-2',
    movie: 'Friday Night at the Multiplex',
    cinema: 'Central Square Multiplex',
    screen: 'Screen 2',
    showtime: 'Tonight, 10:15 PM',
    config: {
      tiers: {
        Silver: { pricePaisa: 14000, available: true, availableQuantity: 32 },
        Gold: { pricePaisa: 23000, available: true, availableQuantity: 18 },
        Recliner: { pricePaisa: 38000, available: true, availableQuantity: 4 }
      },
      festivalDiscountPaisa: 500,
      memberDiscountPercent: 10,
      memberDiscountCapPaisa: 1000,
      convenienceFeePaisaPerTicket: 125,
      gstPercent: 18
    }
  }]
]);

function publicShow(show) {
  return {
    id: show.id,
    movie: show.movie,
    cinema: show.cinema,
    screen: show.screen,
    showtime: show.showtime,
    config: show.config
  };
}

export function listShows() {
  return [...shows.values()].map(publicShow);
}

export function getShow(showId) {
  const show = shows.get(showId);
  if (!show) {
    throw new Error(`Show not found: ${showId}`);
  }
  return show;
}

export function calculateShowPricing({ showId, tickets, isMember = false }) {
  const show = getShow(showId);
  return calculatePricing({ tickets, isMember, config: show.config });
}

export function bookShow({ showId, tickets, isMember = false }) {
  const show = getShow(showId);
  const bill = calculatePricing({ tickets, isMember, config: show.config });

  for (const tier of TICKET_TIERS) {
    const quantity = tickets[tier] ?? 0;
    const tierConfig = show.config.tiers[tier];
    tierConfig.availableQuantity -= quantity;
    tierConfig.available = tierConfig.availableQuantity > 0;
  }

  return {
    bookingId: `booking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    show: publicShow(show),
    bill,
    message: 'Booking confirmed'
  };
}