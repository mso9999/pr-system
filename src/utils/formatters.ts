import { Timestamp } from 'firebase/firestore';

export function formatCurrency(amount: number, currency: string = 'LSL', withSymbol: boolean = true): string {
  if (!withSymbol) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'LSL'
  }).format(amount);
}

export function calculateDaysOpen(createdAt: string | Date | Timestamp): number {
  if (!createdAt) return 0;

  let startDate: Date;
  if (createdAt instanceof Timestamp) {
    startDate = createdAt.toDate();
  } else if (createdAt instanceof Date) {
    startDate = createdAt;
  } else {
    startDate = new Date(createdAt);
  }

  const endDate = new Date();
  
  console.log('Days calculation:', {
    input: createdAt,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    diffDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  });

  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}
