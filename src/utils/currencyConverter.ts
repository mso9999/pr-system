import { getFirestore, collection, getDocs } from 'firebase/firestore';

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  updatedAt: string;
}

const EXCHANGE_RATES_COLLECTION = 'exchangeRates';

// Cache for exchange rates to avoid repeated Firestore queries
let cachedRates: ExchangeRate[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

async function getExchangeRates(): Promise<ExchangeRate[]> {
  const now = Date.now();
  if (cachedRates && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    return cachedRates;
  }

  const db = getFirestore();
  const ratesRef = collection(db, EXCHANGE_RATES_COLLECTION);
  const ratesSnap = await getDocs(ratesRef);
  
  cachedRates = ratesSnap.docs.map(doc => doc.data() as ExchangeRate);
  cacheTimestamp = now;
  
  return cachedRates;
}

/**
 * Clear the exchange rate cache (useful for testing or after updates)
 */
export function clearExchangeRateCache(): void {
  cachedRates = null;
  cacheTimestamp = 0;
}

export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  // Normalize currency codes to uppercase
  const normalizedFromCurrency = (fromCurrency || 'LSL').toUpperCase();
  const normalizedToCurrency = (toCurrency || 'LSL').toUpperCase();

  console.log('Converting amount:', {
    amount,
    from: normalizedFromCurrency,
    to: normalizedToCurrency
  });

  if (normalizedFromCurrency === normalizedToCurrency) {
    console.log('Same currency, returning original amount:', amount);
    return amount;
  }

  const rates = await getExchangeRates();
  
  // Find direct conversion rate
  const directRate = rates.find(rate => 
    rate.from.toUpperCase() === normalizedFromCurrency && 
    rate.to.toUpperCase() === normalizedToCurrency
  );

  if (directRate) {
    const result = amount * directRate.rate;
    console.log('Using direct rate:', {
      rate: directRate.rate,
      result
    });
    return result;
  }

  // Try reverse rate
  const reverseRate = rates.find(rate => 
    rate.from.toUpperCase() === normalizedToCurrency && 
    rate.to.toUpperCase() === normalizedFromCurrency
  );

  if (reverseRate) {
    const result = amount / reverseRate.rate;
    console.log('Using reverse rate:', {
      rate: reverseRate.rate,
      result
    });
    return result;
  }

  // No conversion rate found, return original amount
  console.warn('No conversion rate found, returning original amount:', amount);
  return amount;
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
