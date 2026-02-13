import { getFirestore, collection, getDocs } from 'firebase/firestore';

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  updatedAt: string;
}

interface CachedRates {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

/**
 * Metadata about a currency conversion for audit trail
 */
export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  exchangeRate: number;
  rateSource: 'live_api' | 'fallback_static' | 'firestore' | 'cross_conversion' | 'pegged' | 'same_currency';
  rateTimestamp: string;
  apiProvider?: string;
}

/**
 * Exchange rate record to store on PR/PO for audit trail
 */
export interface ExchangeRateRecord {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  fetchedAt: string;
  apiProvider?: string;
}

// Cache for live exchange rates (1 hour cache)
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour
let liveRatesCache: CachedRates | null = null;

// Fallback static rates for currencies not available in free APIs
// These are approximate rates and should be updated periodically
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USD: {
    LSL: 18.5,    // Lesotho Loti (pegged to ZAR)
    ZAR: 18.5,    // South African Rand
    XOF: 605,     // CFA Franc BCEAO (West Africa)
    XAF: 605,     // CFA Franc BEAC (Central Africa)
    EUR: 0.92,
    GBP: 0.79,
  },
  EUR: {
    LSL: 20.1,
    ZAR: 20.1,
    XOF: 655.957, // Fixed rate (CFA is pegged to EUR)
    XAF: 655.957,
    USD: 1.09,
    GBP: 0.86,
  },
  ZAR: {
    LSL: 1.0,     // LSL is pegged 1:1 to ZAR
    USD: 0.054,
    EUR: 0.050,
  },
  LSL: {
    ZAR: 1.0,     // LSL is pegged 1:1 to ZAR
    USD: 0.054,
    EUR: 0.050,
  },
  XOF: {
    EUR: 0.001524, // 1/655.957
    USD: 0.00165,
  },
};

/**
 * Fetch live exchange rates from Frankfurter API (free, no API key required)
 * Uses European Central Bank data
 */
async function fetchLiveRates(baseCurrency: string = 'USD'): Promise<CachedRates | null> {
  const now = Date.now();
  
  // Return cached rates if still valid
  if (liveRatesCache && 
      liveRatesCache.base === baseCurrency && 
      (now - liveRatesCache.timestamp) < CACHE_DURATION_MS) {
    console.log('Using cached live exchange rates');
    return liveRatesCache;
  }

  try {
    // Frankfurter API - free, no key required, uses ECB data
    const response = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    
    liveRatesCache = {
      base: baseCurrency,
      rates: data.rates,
      timestamp: now
    };

    console.log('Fetched live exchange rates:', {
      base: baseCurrency,
      ratesCount: Object.keys(data.rates).length,
      sampleRates: Object.entries(data.rates).slice(0, 5)
    });

    return liveRatesCache;
  } catch (error) {
    console.warn('Failed to fetch live exchange rates:', error);
    return null;
  }
}

interface RateResult {
  rate: number;
  source: ConversionResult['rateSource'];
  apiProvider?: string;
}

/**
 * Get exchange rate between two currencies with source tracking
 * Priority: Live API rates > Fallback static rates > Firestore rates
 */
async function getExchangeRate(from: string, to: string): Promise<RateResult | null> {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  // Same currency = 1:1
  if (fromUpper === toUpper) {
    return { rate: 1, source: 'same_currency' };
  }

  // Special case: LSL and ZAR are pegged 1:1
  if ((fromUpper === 'LSL' && toUpper === 'ZAR') || 
      (fromUpper === 'ZAR' && toUpper === 'LSL')) {
    return { rate: 1, source: 'pegged' };
  }

  // Try to get live rates first
  const liveRates = await fetchLiveRates(fromUpper);
  
  if (liveRates && liveRates.rates[toUpper]) {
    console.log(`Live rate found: ${fromUpper} → ${toUpper} = ${liveRates.rates[toUpper]}`);
    return { 
      rate: liveRates.rates[toUpper], 
      source: 'live_api',
      apiProvider: 'frankfurter.app (ECB)'
    };
  }

  // For exotic currencies (LSL, XOF), try cross-conversion through USD or EUR
  if (!liveRates?.rates[toUpper]) {
    // Try converting through USD
    const crossRate = await getCrossConversionRate(fromUpper, toUpper);
    if (crossRate) {
      console.log(`Cross-conversion rate: ${fromUpper} → ${toUpper} = ${crossRate}`);
      return { 
        rate: crossRate, 
        source: 'cross_conversion',
        apiProvider: 'frankfurter.app + fallback rates'
      };
    }
  }

  // Fall back to static rates
  if (FALLBACK_RATES[fromUpper]?.[toUpper]) {
    const rate = FALLBACK_RATES[fromUpper][toUpper];
    console.log(`Using fallback rate: ${fromUpper} → ${toUpper} = ${rate}`);
    return { rate, source: 'fallback_static' };
  }

  // Try reverse fallback rate
  if (FALLBACK_RATES[toUpper]?.[fromUpper]) {
    const rate = 1 / FALLBACK_RATES[toUpper][fromUpper];
    console.log(`Using reverse fallback rate: ${fromUpper} → ${toUpper} = ${rate}`);
    return { rate, source: 'fallback_static' };
  }

  // Last resort: try Firestore
  const firestoreRate = await getFirestoreRate(fromUpper, toUpper);
  if (firestoreRate) {
    return { rate: firestoreRate, source: 'firestore' };
  }

  return null;
}

/**
 * Calculate cross-conversion rate through a common currency (USD or EUR)
 */
async function getCrossConversionRate(from: string, to: string): Promise<number | null> {
  // Common currencies to use as intermediaries
  const intermediaries = ['USD', 'EUR'];

  for (const intermediate of intermediaries) {
    if (from === intermediate || to === intermediate) continue;

    // Get rate from source to intermediate
    let fromToIntermediate: number | null = null;
    
    // Check fallback rates for exotic currencies
    if (FALLBACK_RATES[from]?.[intermediate]) {
      fromToIntermediate = FALLBACK_RATES[from][intermediate];
    } else if (FALLBACK_RATES[intermediate]?.[from]) {
      fromToIntermediate = 1 / FALLBACK_RATES[intermediate][from];
    } else {
      // Try live rates
      const liveRates = await fetchLiveRates(from);
      if (liveRates?.rates[intermediate]) {
        fromToIntermediate = liveRates.rates[intermediate];
      }
    }

    if (!fromToIntermediate) continue;

    // Get rate from intermediate to target
    let intermediateToTarget: number | null = null;
    
    if (FALLBACK_RATES[intermediate]?.[to]) {
      intermediateToTarget = FALLBACK_RATES[intermediate][to];
    } else if (FALLBACK_RATES[to]?.[intermediate]) {
      intermediateToTarget = 1 / FALLBACK_RATES[to][intermediate];
    } else {
      const liveRates = await fetchLiveRates(intermediate);
      if (liveRates?.rates[to]) {
        intermediateToTarget = liveRates.rates[to];
      }
    }

    if (intermediateToTarget) {
      return fromToIntermediate * intermediateToTarget;
    }
  }

  return null;
}

/**
 * Get exchange rate from Firestore (legacy fallback)
 */
async function getFirestoreRate(from: string, to: string): Promise<number | null> {
  try {
    const db = getFirestore();
    const ratesRef = collection(db, 'exchangeRates');
    const ratesSnap = await getDocs(ratesRef);
    
    const rates = ratesSnap.docs.map(doc => doc.data() as ExchangeRate);
    
    // Find direct rate
    const directRate = rates.find(rate => 
      rate.from.toUpperCase() === from && 
      rate.to.toUpperCase() === to
    );
    if (directRate) {
      console.log(`Firestore rate found: ${from} → ${to} = ${directRate.rate}`);
      return directRate.rate;
    }

    // Find reverse rate
    const reverseRate = rates.find(rate => 
      rate.from.toUpperCase() === to && 
      rate.to.toUpperCase() === from
    );
    if (reverseRate) {
      console.log(`Firestore reverse rate found: ${from} → ${to} = ${1/reverseRate.rate}`);
      return 1 / reverseRate.rate;
    }

    return null;
  } catch (error) {
    console.warn('Error fetching Firestore rates:', error);
    return null;
  }
}

/**
 * Clear the exchange rate cache (useful for testing or forcing refresh)
 */
export function clearExchangeRateCache(): void {
  liveRatesCache = null;
}

/**
 * Convert an amount from one currency to another with full metadata
 * Uses live rates from Frankfurter API with fallbacks
 * Returns detailed conversion info for audit trail
 */
export async function convertAmountWithMetadata(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<ConversionResult> {
  const normalizedFromCurrency = (fromCurrency || 'LSL').toUpperCase();
  const normalizedToCurrency = (toCurrency || 'LSL').toUpperCase();
  const timestamp = new Date().toISOString();

  console.log('Converting amount:', {
    amount,
    from: normalizedFromCurrency,
    to: normalizedToCurrency
  });

  if (normalizedFromCurrency === normalizedToCurrency) {
    console.log('Same currency, returning original amount:', amount);
    return {
      originalAmount: amount,
      originalCurrency: normalizedFromCurrency,
      convertedAmount: amount,
      targetCurrency: normalizedToCurrency,
      exchangeRate: 1,
      rateSource: 'same_currency',
      rateTimestamp: timestamp
    };
  }

  const rateResult = await getExchangeRate(normalizedFromCurrency, normalizedToCurrency);

  if (rateResult) {
    const convertedAmount = amount * rateResult.rate;
    console.log('Conversion result:', {
      originalAmount: amount,
      from: normalizedFromCurrency,
      to: normalizedToCurrency,
      rate: rateResult.rate,
      source: rateResult.source,
      result: convertedAmount
    });
    return {
      originalAmount: amount,
      originalCurrency: normalizedFromCurrency,
      convertedAmount,
      targetCurrency: normalizedToCurrency,
      exchangeRate: rateResult.rate,
      rateSource: rateResult.source,
      rateTimestamp: timestamp,
      apiProvider: rateResult.apiProvider
    };
  }

  // No conversion rate found, return original amount with warning
  console.warn('No conversion rate found, returning original amount:', {
    amount,
    from: normalizedFromCurrency,
    to: normalizedToCurrency
  });
  return {
    originalAmount: amount,
    originalCurrency: normalizedFromCurrency,
    convertedAmount: amount,
    targetCurrency: normalizedToCurrency,
    exchangeRate: 1,
    rateSource: 'same_currency', // Fallback - no rate found
    rateTimestamp: timestamp
  };
}

/**
 * Convert an amount from one currency to another
 * Uses live rates from Frankfurter API with fallbacks
 * Returns just the converted amount (for backward compatibility)
 */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  const result = await convertAmountWithMetadata(amount, fromCurrency, toCurrency);
  return result.convertedAmount;
}

/**
 * Check if an amount exceeds a threshold, converting currencies if needed.
 * @param amount The amount to check
 * @param amountCurrency The currency of the amount
 * @param threshold The threshold to compare against
 * @param thresholdCurrency The currency of the threshold (from rule.uom or rule.currency)
 * @returns Object with isAbove flag and converted amount
 */
export async function isAmountAboveThreshold(
  amount: number,
  amountCurrency: string,
  threshold: number,
  thresholdCurrency: string
): Promise<{ isAbove: boolean; convertedAmount: number; thresholdCurrency: string }> {
  const convertedAmount = await convertAmount(
    amount,
    amountCurrency || 'LSL',
    thresholdCurrency || 'LSL'
  );
  
  return {
    isAbove: convertedAmount > threshold,
    convertedAmount,
    thresholdCurrency: thresholdCurrency || 'LSL'
  };
}

/**
 * Get the currency from a rule object (handles both 'uom' and 'currency' fields)
 */
export function getRuleCurrency(rule: { uom?: string; currency?: string } | null | undefined): string {
  if (!rule) return 'LSL';
  return rule.uom || rule.currency || 'LSL';
}
