export const TICKET_TIERS = Object.freeze(['Silver', 'Gold', 'Recliner']);

export const DEFAULT_PRICING_CONFIG = Object.freeze({
  tiers: Object.freeze({
    Silver: Object.freeze({ pricePaisa: 15000, available: true }),
    Gold: Object.freeze({ pricePaisa: 25000, available: true }),
    Recliner: Object.freeze({ pricePaisa: 40000, available: true })
  }),
  festivalDiscountPaisa: 0,
  memberDiscountPercent: 0,
  memberDiscountCapPaisa: 0,
  convenienceFeePaisaPerTicket: 0,
  gstPercent: 0
});

function assertNonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer in paisa`);
  }
}

function assertPercentage(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a percentage between 0 and 100`);
  }
}

function roundPercentagePaisa(amountPaisa, percentage) {
  return Math.floor((amountPaisa * percentage + 50) / 100);
}

function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Pricing config is required');
  }

  if (!config.tiers || typeof config.tiers !== 'object') {
    throw new Error('Pricing config must include ticket tiers');
  }

  for (const tier of TICKET_TIERS) {
    const tierConfig = config.tiers[tier];
    if (!tierConfig || typeof tierConfig !== 'object') {
      throw new Error(`Pricing config is missing the ${tier} tier`);
    }
    assertNonNegativeInteger(tierConfig.pricePaisa, `${tier} pricePaisa`);
    if (typeof tierConfig.available !== 'boolean') {
      throw new Error(`${tier} availability must be a boolean`);
    }
    if (tierConfig.availableQuantity !== undefined) {
      assertNonNegativeInteger(tierConfig.availableQuantity, `${tier} availableQuantity`);
    }
  }

  assertNonNegativeInteger(config.festivalDiscountPaisa, 'festivalDiscountPaisa');
  assertPercentage(config.memberDiscountPercent, 'memberDiscountPercent');
  assertNonNegativeInteger(config.memberDiscountCapPaisa, 'memberDiscountCapPaisa');
  assertNonNegativeInteger(config.convenienceFeePaisaPerTicket, 'convenienceFeePaisaPerTicket');
  assertPercentage(config.gstPercent, 'gstPercent');
}

function validateTickets(tickets, config) {
  if (!tickets || typeof tickets !== 'object' || Array.isArray(tickets)) {
    throw new Error('tickets must be an object keyed by ticket tier');
  }

  for (const tier of Object.keys(tickets)) {
    if (!TICKET_TIERS.includes(tier)) {
      throw new Error(`Unknown ticket tier: ${tier}`);
    }
  }

  const quantities = {};
  let totalTickets = 0;

  for (const tier of TICKET_TIERS) {
    const quantity = tickets[tier] ?? 0;
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new Error(`${tier} quantity must be a non-negative integer`);
    }
    if (quantity > 0 && !config.tiers[tier].available) {
      throw new Error(`${tier} tier is sold out`);
    }
    if (
      config.tiers[tier].availableQuantity !== undefined
      && quantity > config.tiers[tier].availableQuantity
    ) {
      throw new Error(
        `${tier} has insufficient availability: requested ${quantity}, available ${config.tiers[tier].availableQuantity}`
      );
    }
    quantities[tier] = quantity;
    totalTickets += quantity;
  }

  if (totalTickets === 0) {
    throw new Error('At least one ticket is required');
  }

  return { quantities, totalTickets };
}

export function calculatePricing({ tickets, isMember = false, config = DEFAULT_PRICING_CONFIG }) {
  validateConfig(config);

  if (typeof isMember !== 'boolean') {
    throw new Error('isMember must be a boolean');
  }

  const { quantities, totalTickets } = validateTickets(tickets, config);
  const ticketLines = TICKET_TIERS.map((tier) => ({
    tier,
    quantity: quantities[tier],
    unitPricePaisa: config.tiers[tier].pricePaisa,
    totalPaisa: quantities[tier] * config.tiers[tier].pricePaisa
  })).filter((line) => line.quantity > 0);

  const baseTicketTotalPaisa = ticketLines.reduce((total, line) => total + line.totalPaisa, 0);
  const festivalDiscountPaisa = Math.min(config.festivalDiscountPaisa, baseTicketTotalPaisa);
  const totalAfterFestivalDiscountPaisa = baseTicketTotalPaisa - festivalDiscountPaisa;
  const calculatedMemberDiscountPaisa = isMember
    ? roundPercentagePaisa(totalAfterFestivalDiscountPaisa, config.memberDiscountPercent)
    : 0;
  const memberDiscountPaisa = Math.min(
    calculatedMemberDiscountPaisa,
    config.memberDiscountCapPaisa,
    totalAfterFestivalDiscountPaisa
  );
  const discountedTicketTotalPaisa = totalAfterFestivalDiscountPaisa - memberDiscountPaisa;
  const convenienceFeePaisa = totalTickets * config.convenienceFeePaisaPerTicket;
  const taxableTotalPaisa = discountedTicketTotalPaisa + convenienceFeePaisa;
  const gstPaisa = roundPercentagePaisa(taxableTotalPaisa, config.gstPercent);
  const finalTotalPaisa = taxableTotalPaisa + gstPaisa;

  return {
    tickets: ticketLines,
    totalTickets,
    baseTicketTotalPaisa,
    festivalDiscountPaisa,
    memberDiscountPaisa,
    discountedTicketTotalPaisa,
    convenienceFeePaisa,
    taxableTotalPaisa,
    gstPaisa,
    finalTotalPaisa,
    currency: 'INR',
    calculation: {
      isMember,
      festivalDiscountPaisaConfigured: config.festivalDiscountPaisa,
      memberDiscountPercent: config.memberDiscountPercent,
      memberDiscountCapPaisa: config.memberDiscountCapPaisa,
      convenienceFeePaisaPerTicket: config.convenienceFeePaisaPerTicket,
      gstPercent: config.gstPercent
    }
  };
}