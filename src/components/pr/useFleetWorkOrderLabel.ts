import { useEffect, useState } from 'react';
import { getFleetWorkOrder, type FleetWorkOrder } from '../../services/fleetWorkOrders';

/**
 * Resolve a linked Fleet work order id to a short display label
 * ("WO-LS-2026-00172 · Gearbox down"). Returns null while loading or on
 * failure — callers fall back to a generic "linked" label.
 */
export function useFleetWorkOrderLabel(id?: string | null): string | null {
  const [wo, setWo] = useState<FleetWorkOrder | null>(null);

  useEffect(() => {
    if (!id) {
      setWo(null);
      return;
    }
    let cancelled = false;
    getFleetWorkOrder(id)
      .then((w) => {
        if (!cancelled) setWo(w);
      })
      .catch(() => {
        /* caller falls back */
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id || !wo) return null;
  return `${wo.workOrderNumber ? `${wo.workOrderNumber} · ` : ''}${wo.title || 'Work order'}`;
}
