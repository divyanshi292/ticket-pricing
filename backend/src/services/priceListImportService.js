import { TICKET_TIERS } from './pricingService.js';

const TIER_NAMES = new Map(TICKET_TIERS.map((tier) => [tier.toLowerCase(), tier]));

function parsePricePaisa(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    value = String(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const cleanedValue = value
    .trim()
    .replace(/^(?:₹|rs\.?|inr)\s*/i, '')
    .replace(/[\s,]/g, '');

  if (!/^\d+(?:\.\d{1,2})?$/.test(cleanedValue)) {
    return null;
  }

  const [rupees, paise = ''] = cleanedValue.split('.');
  const pricePaisa = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
  return Number.isSafeInteger(pricePaisa) ? pricePaisa : null;
}

function canonicalizeTier(value) {
  if (typeof value !== 'string') {
    return null;
  }
  return TIER_NAMES.get(value.trim().toLowerCase()) || null;
}

export function importPriceList(priceList) {
  if (!Array.isArray(priceList)) {
    throw new Error('prices must be an array');
  }

  const imported = [];
  const deduplicated = [];
  const rejected = [];
  const seenTiers = new Map();

  priceList.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      rejected.push({ index, entry, reason: 'Entry must be an object' });
      return;
    }

    const sourceName = entry.name ?? entry.tier ?? entry.class;
    const sourcePrice = entry.price ?? entry.amount;
    const tier = canonicalizeTier(sourceName);

    if (!tier) {
      rejected.push({ index, entry, reason: 'Unknown or blank tier name' });
      return;
    }

    if (sourcePrice === null || sourcePrice === undefined || String(sourcePrice).trim() === '') {
      rejected.push({ index, entry, reason: 'Price is blank' });
      return;
    }

    const priceText = String(sourcePrice).trim();
    if (/^-|\(/.test(priceText)) {
      rejected.push({ index, entry, reason: 'Price cannot be negative' });
      return;
    }

    const pricePaisa = parsePricePaisa(sourcePrice);
    if (pricePaisa === null) {
      rejected.push({ index, entry, reason: 'Price must be a valid non-negative rupee amount' });
      return;
    }

    if (seenTiers.has(tier)) {
      deduplicated.push({
        index,
        name: sourceName,
        canonicalTier: tier,
        keptIndex: seenTiers.get(tier)
      });
      return;
    }

    seenTiers.set(tier, index);
    imported.push({
      index,
      sourceName,
      sourcePrice,
      tier,
      pricePaisa
    });
  });

  return {
    imported,
    deduplicated,
    rejected,
    summary: {
      received: priceList.length,
      imported: imported.length,
      deduplicated: deduplicated.length,
      rejected: rejected.length
    }
  };
}