import * as admin from 'firebase-admin';

/** AM legacy country_id is a field value, not necessarily the document ID. */
export async function amCountry(tx: admin.firestore.Transaction, countryId: unknown) {
  if (typeof countryId !== 'string' || !countryId || countryId.includes('/')) throw new Error('AM country identity is missing');
  const countries = admin.firestore().collection('pr_master_countries');
  const [direct, byField] = await Promise.all([
    tx.get(countries.doc(countryId)),
    tx.get(countries.where('country_id', '==', countryId).limit(2)),
  ]);
  const matches = new Map(byField.docs.map(d => [d.id, d.data()]));
  if (direct.exists) matches.set(direct.id, direct.data()!);
  if (matches.size !== 1) throw new Error('AM country identity is missing or ambiguous; reconcile country references');
  return [...matches.values()][0];
}
