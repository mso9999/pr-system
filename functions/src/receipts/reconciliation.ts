import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { id, unit, hash, Row, stockItem, signedGrant, assetInOrganizationScope } from './policy';
import { amCountry } from './country';
import review from './masMappingReview.json';
import { reconciliationBlock } from './reconciliationGuards';

/** Joint workshop: the signed AM approver records the RET participant's attestation. */
export const saveAmReconciliation = functions.https.onCall(async (data, context) => {
  const grant = signedGrant(context.auth?.token, 'am');
  if (!context.auth || context.auth.token.nexus_sso !== true || !context.auth.token.privilegeVersion ||
      !grant?.actions?.some((a: string) => ['approve_assets', 'administer_assets'].includes(a)))
    throw new functions.https.HttpsError('permission-denied', 'An AM approver signed in through Nexus must save the workshop decision.');
  try {
    const partId = String(data.ugpPartId || ""), eventId = id(data.eventId);
    if (!/^[a-z0-9][a-z0-9_.-]{0,149}$/.test(partId)) throw new Error("Invalid UGP part number.");
    const part = (review.parts as Row)[partId];
    if (!part) throw new Error('Select a part from the MAS pilot.');
    const decision = String(data.decision || '');
    if (!['same_part', 'alternative', 'component', 'not_match', 'need_photo', 'need_specification', 'not_found'].includes(decision)) throw new Error('Select a valid decision.');
    const assets: string[] = Array.isArray(data.assetIds) ? [...new Set<string>(data.assetIds.map(id))].sort() : [];
    if (assets.length > 10 || (!['not_found', 'need_specification', 'need_photo'].includes(decision) && !assets.length)) throw new Error('Select between one and ten AM items for this decision.');
    const evidence = String(data.evidence || '').trim(), ret = String(data.retParticipant || '').trim();
    if (evidence.length < 20 || evidence.length > 2000 || ret.length < 3 || ret.length > 120) throw new Error('Enter the RET participant and at least 20 characters of specification evidence or follow-up instructions.');
    const publish = decision === 'same_part';
    if (publish && data.confirmedPartId !== partId) throw new Error('Confirm the exact UGP requirement in the comparison before publication.');
    if (publish && (data.retVerified !== true || data.amVerified !== true || data.currentSpecificationVerified !== true)) throw new Error('RET and AM checks and the current UGP specification check are required before publication.');
    const owner = String(data.ownerName || '').trim(), due = String(data.dueDate || '');
    if (!publish && decision !== 'not_match' && (!owner || owner.length > 120 || !/^\d{4}-\d{2}-\d{2}$/.test(due) || !Number.isFinite(Date.parse(due)) || new Date(due).toISOString().slice(0,10) !== due)) throw new Error('Give the unresolved decision an owner and valid due date.');
    if (!Array.isArray(grant.scopeCountries) || !Array.isArray(grant.scopeOrganizations)) throw new Error('Refresh Nexus sign-in for scoped access.');
    if (grant.scopeCountries.length && !grant.scopeCountries.includes('LS')) throw new Error('Lesotho access is required.');
    const db = admin.firestore(), eventRef = db.collection('am_core_mapping_reviews').doc(eventId);
    const body = { partId, assets, decision, evidence, confirmedPartId: data.confirmedPartId || '', retParticipant: ret, owner, due,
      actor: context.auth.uid, referenceHash: hash(review), expected: data.expectedAssets || {} };
    const digest = hash(body);
    return await db.runTransaction(async tx => {
      const prior = await tx.get(eventRef);
      if (prior.exists) {
        if (prior.get('requestHash') !== digest) throw new Error('This submission ID was already used. Reload before saving another decision.');
        return { saved: true, published: prior.get('published'), eventId, unchanged: true };
      }
      const refs = assets.map(a => db.collection('am_core_assets').doc(a));
      const snaps = refs.length ? await tx.getAll(...refs) : [];
      for (const snap of snaps) {
        const asset = snap.data();
        if (!asset || !stockItem(asset)) throw new Error('Every selection must be an active stock item.');
        const country = await amCountry(tx, asset.country_id);
        if ((country?.iso2 || country?.country_code_2 || country?.code) !== 'LS') throw new Error('Only Lesotho items can be reconciled in this pilot.');
        if (!assetInOrganizationScope(grant.scopeOrganizations, asset, country)) throw new Error('An item is outside your organization scope.');
        // Compare identity fields, not stock quantity; a delivery need not invalidate a review.
        const expected = data.expectedAssets?.[snap.id];
        const identity = { name: asset.name || '', unit: asset.unit_of_measure || '', ugpPartId: asset.ugp_part_id || '', definitionId: asset.definition_id || '', manufacturer: asset.manufacturer || '', model: asset.model || '', description: asset.description || '' };
        if (!expected || hash(expected) !== hash(identity)) throw new Error('An item changed since this screen loaded. Reload and review it again.');
        if (publish && unit(asset.unit_of_measure) !== unit(part.unit)) throw new Error('Units differ. Resolve units or assembly quantities instead of publishing an identical part.');
        if (publish) { const block = reconciliationBlock(partId, snap.id, asset, part); if (block) throw new Error(block); }
        if (publish && asset.ugp_part_id && asset.ugp_part_id !== partId) throw new Error('An existing UGP link conflicts. It must be resolved separately.');
        if (publish && asset.definition_id && asset.definition_id !== 'ugp-' + partId) throw new Error('An existing shared definition must be reconciled separately; it will not be overwritten.');
      }
      const defRef = db.collection('am_part_definitions').doc('ugp-' + partId);
      const definition = publish ? await tx.get(defRef) : null;
      if (definition?.exists && (definition.get('canonical_approved') !== true || definition.get('ugp_part_id') !== partId || definition.get('name') !== part.name || definition.get('technical_specification') !== part.specification || unit(definition.get('unit_of_measure')) !== unit(part.unit))) throw new Error('The shared definition differs. A catalogue steward must reconcile it before publication.');
      const photos = publish && assets.length ? await tx.get(db.collection('am_part_media').where('asset_id', 'in', assets)) : null;
      const now = new Date().toISOString();
      if (publish) {
        if (!definition?.exists) tx.create(defRef, { name: part.name, description: part.specification, technical_specification: part.specification,
          canonical_part_number: partId, ugp_part_id: partId, unit_of_measure: part.unit, classification: 'ugp_linked',
          canonical_approved: true, forecast_ready: true, revision: 1, active: true, created_at: now, updated_at: now,
          created_by: context.auth!.uid, verification_event_id: eventId });
        snaps.forEach(snap => {
          const a = snap.data()!;
          tx.update(snap.ref, { name: part.name, canonical_part_number: partId,
            original_catalogue_identity: a.original_catalogue_identity || { name: a.name || '', description: a.description || '', manufacturer: a.manufacturer || '', model: a.model || '', captured_at: now },
            catalogue_aliases: [...new Set([...(Array.isArray(a.catalogue_aliases) ? a.catalogue_aliases : []), a.name].filter(Boolean))],
            definition_id: defRef.id, ugp_part_id: partId, updated_at: now,
            ugp_mapping_verification: { eventId, by: context.auth!.uid, at: now, evidence, retParticipant: ret, referenceHash: hash(review) } });
        });
        photos?.docs.filter(photo => photo.get('approved') === true).forEach(photo => tx.update(photo.ref, { definition_id: defRef.id }));
      } else if (decision !== 'not_match') {
        tx.create(db.collection('am_catalogue_tasks').doc(eventId), { task_type: decision === 'need_photo' ? 'capture_reference_image' : 'verify_ugp_match',
          status: 'open', reason: `${part.name}: ${decision}. ${evidence}`, ugp_part_id: partId, asset_ids: assets,
          owner_name: owner, due_at: due, site_impact: 'MAS', created_at: now, updated_at: now, created_by: context.auth!.uid,
          workshop_event_id: eventId });
      }
      tx.create(eventRef, { ...body, requestHash: digest, published: publish, created_at: now,
        retAttestationType: 'named_participant_recorded_by_am_approver',
        before: snaps.map(s => ({ assetId: s.id, name: s.get('name') || '', description: s.get('description') || '', ugp_part_id: s.get('ugp_part_id') || null, definition_id: s.get('definition_id') || null })),
        definition_id: publish ? defRef.id : null });
      return { saved: true, published: publish, eventId, definitionId: publish ? defRef.id : null };
    });
  } catch (error) { throw new functions.https.HttpsError('failed-precondition', error instanceof Error ? error.message : 'Reconciliation failed'); }
});
