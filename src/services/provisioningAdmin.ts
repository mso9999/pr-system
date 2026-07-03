/**
 * Frontend wrappers for the permission-gated provisioning catalog CRUD Cloud Functions.
 *
 * All writes route through `functions/src/provisioning/provisioningAdmin.ts`, which
 * enforces ADMIN/PROC access server-side via the Admin SDK (bypassing Firestore rules).
 * The studio UI calls these instead of writing Firestore directly.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type {
  RationItem,
  RationPriceEntry,
  ProvisioningDefaults,
  ProvisioningMenu,
} from '../types/provisioning';

export interface ProvisioningCatalogResult {
  organization: { id: string; name: string; currency?: string; countryCode?: string };
  rations: RationItem[];
  prices: RationPriceEntry[];
  defaults: ProvisioningDefaults | null;
  menu: ProvisioningMenu | null;
}

export interface SaveResult {
  id: string;
  organization: { id: string; name: string; currency?: string; countryCode?: string };
}

const call = <Req, Res>(name: string) => httpsCallable<Req, Res>(functions, name);

export function listProvisioningCatalog(organizationId: string): Promise<ProvisioningCatalogResult> {
  return call<{ organizationId: string }, ProvisioningCatalogResult>('listProvisioningCatalog')({ organizationId }).then((r) => r.data);
}

export function saveProvisioningRation(organizationId: string, ration: Partial<RationItem>): Promise<SaveResult> {
  return call<{ organizationId: string; ration: Partial<RationItem> }, SaveResult>('saveProvisioningRation')({ organizationId, ration }).then((r) => r.data);
}

export function retireProvisioningRation(organizationId: string, rationId: string): Promise<{ retiredRation: string; retiredPrices: number }> {
  return call<{ organizationId: string; rationId: string }, { retiredRation: string; retiredPrices: number }>('retireProvisioningRation')({ organizationId, rationId }).then((r) => r.data);
}

export function saveProvisioningPrice(organizationId: string, price: Partial<RationPriceEntry>): Promise<SaveResult> {
  return call<{ organizationId: string; price: Partial<RationPriceEntry> }, SaveResult>('saveProvisioningPrice')({ organizationId, price }).then((r) => r.data);
}

export function retireProvisioningPrice(organizationId: string, priceId: string): Promise<{ retiredPrice: string }> {
  return call<{ organizationId: string; priceId: string }, { retiredPrice: string }>('retireProvisioningPrice')({ organizationId, priceId }).then((r) => r.data);
}

export function saveProvisioningDefaults(organizationId: string, defaults: Partial<ProvisioningDefaults>): Promise<SaveResult> {
  return call<{ organizationId: string; defaults: Partial<ProvisioningDefaults> }, SaveResult>('saveProvisioningDefaults')({ organizationId, defaults }).then((r) => r.data);
}

export function saveProvisioningMenu(organizationId: string, menu: Partial<ProvisioningMenu>): Promise<SaveResult> {
  return call<{ organizationId: string; menu: Partial<ProvisioningMenu> }, SaveResult>('saveProvisioningMenu')({ organizationId, menu }).then((r) => r.data);
}
