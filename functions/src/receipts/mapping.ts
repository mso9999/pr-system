import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { randomUUID } from "crypto";
import { id, unit, hash, Row, stockItem, signedGrant } from "./policy";
import review from "./masMappingReview.json";

export const confirmAmUgpMapping = functions.https.onCall(
  async (data, context) => {
    const token = context.auth?.token,
      p = signedGrant(token, "am");
    if (
      !context.auth ||
      token?.nexus_sso !== true ||
      !token.privilegeVersion ||
      !Array.isArray(p?.actions) ||
      !p.actions.some((a: string) =>
        ["approve_assets", "administer_assets"].includes(a),
      )
    )
      throw new functions.https.HttpsError(
        "permission-denied",
        "AM approver access through Nexus is required",
      );
    try {
      const assetId = id(data.assetId),
        partId = id(data.ugpPartId);
      const part = (review.parts as Row)[partId];
      if (
        !part ||
        part.category !== "candidate" ||
        !part.candidateIds.includes(assetId)
      )
        throw new Error(
          "This pair is not an eligible MAS candidate. Conflicting specifications and component-only matches need source-owner resolution first.",
        );
      if (
        data.specificationVerified !== true ||
        data.canonicalPartVerified !== true ||
        typeof data.evidence !== "string" ||
        data.evidence.trim().length < 20 ||
        data.evidence.length > 2000
      )
        throw new Error(
          "Confirm the current UGP specification and the AM item, and record the manufacturer/specification evidence",
        );
      if (
        !Array.isArray(p.scopeOrganizations) ||
        !Array.isArray(p.scopeCountries)
      )
        throw new Error("Refresh Nexus sign-in for scoped access");
      const db = admin.firestore(),
        assetRef = db.collection("am_core_assets").doc(assetId);
      return await db.runTransaction(async (tx) => {
        const assetSnap = await tx.get(assetRef),
          asset = assetSnap.data();
        if (!asset || !stockItem(asset))
          throw new Error("Active stock item required");
        if (
          p.scopeOrganizations.length &&
          !p.scopeOrganizations.includes(asset.organization_id)
        )
          throw new Error("Item organization is outside your scope");
        const country = (
          await tx.get(
            db.collection("pr_master_countries").doc(String(asset.country_id)),
          )
        ).data();
        const iso2 = country?.iso2 || country?.country_code_2 || country?.code;
        if (p.scopeCountries.length && !p.scopeCountries.includes(iso2))
          throw new Error("Item country is outside your scope");
        const existing = asset.ugp_part_id || null;
        if (existing !== (data.expectedUgpPartId || null))
          throw new Error("Mapping changed while reviewing; reload first");
        if (existing && existing !== partId)
          throw new Error(
            "Existing mappings cannot be overwritten by this pilot",
          );
        if (unit(asset.unit_of_measure) !== unit(part.unit))
          throw new Error(
            "Unit mismatch; do not assume a kit/package conversion",
          );
        if (existing === partId) return { mapped: true, unchanged: true };
        const eventId = randomUUID(),
          now = new Date().toISOString();
        const verification = {
          eventId,
          by: context.auth!.uid,
          at: now,
          evidence: data.evidence.trim(),
          referenceSnapshot: review.snapshotId,
          referenceHash: hash(review),
          unit: unit(part.unit),
          ugpPartId: partId,
        };
        tx.update(assetRef, {
          ugp_part_id: partId,
          ugp_mapping_verification: verification,
          updated_at: now,
        });
        tx.create(db.collection("am_core_mapping_reviews").doc(eventId), {
          assetId,
          before: existing,
          after: partId,
          ...verification,
        });
        return { mapped: true, unchanged: false, eventId };
      });
    } catch (error) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        error instanceof Error ? error.message : "Mapping review failed",
      );
    }
  },
);
