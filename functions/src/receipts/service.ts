import { amCountry as resolveAmCountry } from "./country";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { randomUUID } from "crypto";
import {
  eligible,
  hash,
  id,
  orderBasis,
  receiptChange,
  ReceiptLine,
  ReceiptOrder,
  Row,
  unit,
  units,
  stockItem,
  signedGrant,
} from "./policy";

type Context = functions.https.CallableContext;
function amActor(context: Context): string {
  const token = context.auth?.token;
  const actions = signedGrant(token, "am")?.actions;
  if (
    !context.auth ||
    token?.nexus_sso !== true ||
    !token.privilegeVersion ||
    !Array.isArray(actions) ||
    !actions.some((a) => ["approve_assets", "administer_assets"].includes(a))
  ) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "AM approver access through Nexus is required.",
    );
  }
  return context.auth.uid;
}
function prActor(context: Context, required: string[]) {
  const grant = signedGrant(context.auth?.token, "pr");
  if (
    !context.auth ||
    !grant ||
    !required.some((a) => grant.actions.includes(a))
  )
    throw new functions.https.HttpsError(
      "permission-denied",
      "Assigned PR action through Nexus is required",
    );
}
function scope(
  context: Context,
  owner: string,
  country: string | undefined,
  system: "pr" | "am" = "pr",
) {
  const token = context.auth?.token;
  const p = signedGrant(token, system);
  if (
    !p ||
    !Array.isArray(p.scopeOrganizations) ||
    !Array.isArray(p.scopeCountries)
  )
    throw new Error("Refresh Nexus sign-in to obtain scope claims");
  if (p.scopeOrganizations.length && !p.scopeOrganizations.includes(owner))
    throw new Error("Organization is outside your assigned scope");
  if (
    p.scopeCountries.length &&
    (!country || !p.scopeCountries.includes(country))
  )
    throw new Error("Country is outside your assigned scope");
}
function note(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim().length < 10 ||
    value.length > 2000
  )
    throw new Error("Provide a review/evidence note of 10–2000 characters");
  return value.trim();
}
function handler(fn: (data: Row, context: Context) => Promise<unknown>) {
  return functions.https.onCall(async (data, context) => {
    try {
      return await fn(data || {}, context);
    } catch (error) {
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError(
        "failed-precondition",
        error instanceof Error ? error.message : "Receipt review failed",
      );
    }
  });
}

// Validate all positions inside the same transaction as the stock mutation.
// Historical discrepancies require a physical reconciliation, never an inferred repair.
async function reconciledStock(tx: admin.firestore.Transaction, assetId: string, asset: Row) {
  const total = units(asset.quantity);
  const positions = await tx.get(admin.firestore().collection("am_core_inventory_levels").where("asset_id", "==", assetId));
  const locations = new Set<string>();
  let sum = 0;
  if (asset.reconciliation_status && asset.reconciliation_status !== "verified")
    throw new Error("AM stock requires reconciliation before receipt processing");
  for (const position of positions.docs) {
    const row = position.data();
    if (!/^[A-Z]{3}-[A-Z]{2,3}$/.test(row.location_id || "") || locations.has(row.location_id) ||
        (row.reconciliation_status && row.reconciliation_status !== "verified"))
      throw new Error("AM stock requires reconciliation: duplicate, unresolved or unverified location");
    locations.add(row.location_id);
    const onHand = units(row.quantity_on_hand);
    if (units(row.quantity_allocated) > onHand)
      throw new Error("AM stock requires reconciliation: allocation exceeds stock");
    sum += onHand;
  }
  if (!positions.size || sum !== total)
    throw new Error("AM stock requires reconciliation: location totals differ from asset quantity");
  return total;
}

// Explicit prospective enrollment: no mass changes to historical completed orders.
export const enrollPrReceiptPilot = handler(async (data, context) => {
  prActor(context, ["administer_pr"]);
  const prId = id(data.prId),
    ownerId = id(data.ownerId),
    siteDocumentId = id(data.siteDocumentId);
  const evidence = note(data.note);
  if (
    !Array.isArray(data.lines) ||
    !data.lines.length ||
    data.lines.length > 100
  )
    throw new Error("Select 1–100 approved goods lines");
  const db = admin.firestore();
  const ref = db.collection("purchaseRequests").doc(prId),
    policyRef = db.collection("prReceiptOrders").doc(prId);
  return db.runTransaction(async (tx) => {
    const [prSnap, policySnap, siteSnap] = await Promise.all([
      tx.get(ref),
      tx.get(policyRef),
      tx.get(db.collection("referenceData_sites").doc(siteDocumentId)),
    ]);
    const pr = prSnap.data(),
      site = siteSnap.data();
    if (!pr || pr.status !== "ORDERED" || pr.pendingAmendment)
      throw new Error(
        "Only an unchanged ORDERED PO can enter the receipt pilot",
      );
    if (policySnap.exists)
      throw new Error(
        "Order is already enrolled; amendments require a receipt reconciliation, not re-enrollment",
      );
    const country = site?.countryCode;
    if (
      !site ||
      typeof country !== "string" ||
      !/^[A-Z]{2}$/.test(country) ||
      !/^[A-Z]{3}$/.test(site.code || "") ||
      site.active === false ||
      site.organizationId !== ownerId
    )
      throw new Error(
        "Resolve canonical site country, code, active state and asset owner before enrollment",
      );
    scope(context, String(pr.organizationId || pr.organization || ""), country);
    const destinations = [
      pr.site,
      ...(Array.isArray(pr.sites) ? pr.sites : []),
    ];
    if (!destinations.includes(siteDocumentId))
      throw new Error("The selected destination is not recorded on this order");
    const source =
      data.lineSource === "po"
        ? pr.lineItemsWithSKU
        : data.lineSource === "request"
          ? pr.lineItems
          : null;
    if (!Array.isArray(source) || source.length !== data.lines.length)
      throw new Error(
        "Every line from the selected approved source must be included; services/mixed orders are not supported by this pilot",
      );
    const seen = new Set<string>();
    const lines: ReceiptLine[] = [];
    for (let index = 0; index < source.length; index++) {
      const row = source[index],
        selection = data.lines[index];
      const lineId = id(row?.id || "");
      if (seen.has(lineId))
        throw new Error("Order lines need unique stable IDs before enrollment");
      seen.add(lineId);
      if (
        selection.lineId !== lineId ||
        selection.specificationVerified !== true
      )
        throw new Error(
          "Confirm the AM item specification against every approved order line",
        );
      const assetId = id(selection.assetId),
        levelId = id(selection.levelId);
      const [assetSnap, levelSnap] = await Promise.all([
        tx.get(db.collection("am_core_assets").doc(assetId)),
        tx.get(db.collection("am_core_inventory_levels").doc(levelId)),
      ]);
      const asset = assetSnap.data(),
        level = levelSnap.data();
      if (
        !asset ||
        !level ||
        level.asset_id !== assetId ||
        asset.organization_id !== ownerId ||
        !stockItem(asset)
      )
        throw new Error(
          "Select an active AM stock item and its existing inventory position belonging to the asset owner",
        );
      if (unit(asset.unit_of_measure) !== unit(row.uom))
        throw new Error(
          "Exact compatible units are required; kits and substitutions need separate approval",
        );
      // PR code is canonical; AM country/location code must be explicit, never suffix matched.
      const amCountry = await resolveAmCountry(tx, asset.country_id);
      const iso2 =
        amCountry?.iso2 || amCountry?.country_code_2 || amCountry?.code;
      if (iso2 !== country)
        throw new Error(
          "AM/PR country identity requires an explicit matching ISO2 value",
        );
      const country3 = amCountry?.country_code;
      if (
        typeof country3 !== "string" ||
        level.location_id !== `${country3}-${site.code}`
      )
        throw new Error(
          "Inventory position must be at the approved canonical site",
        );
      await reconciledStock(tx, assetId, asset);
      const ordered = units(row.quantity);
      if (!ordered) throw new Error("Ordered quantities must be positive");
      units(level.quantity_on_hand);
      units(level.quantity_allocated);
      lines.push({
        lineId,
        description: String(row.description || lineId),
        ordered,
        unit: unit(row.uom),
        assetId,
        levelId,
        locationId: level.location_id,
        ownerId,
        received: 0,
      });
    }
    const revision = randomUUID(),
      now = new Date().toISOString();
    tx.create(policyRef, {
      revision,
      basisHash: hash(orderBasis(pr)),
      lines,
      ownerId,
      countryCode: country,
      siteDocumentId,
      canonicalSiteCode: site.code,
      enrolledBy: context.auth!.uid,
      enrolledAt: now,
      note: evidence,
      scope: "prospective_whole_unit_goods_pilot",
    });
    tx.update(ref, { receiptEnforced: true, updatedAt: now });
    return { revision, lines };
  });
});

export const recordAmOrderReceipt = handler(async (data, context) => {
  const actor = amActor(context),
    prId = id(data.prId),
    eventId = id(data.eventId),
    lineId = id(data.lineId);
  const evidence = note(data.evidence),
    quantity = units(data.quantity);
  if (!quantity || data.acceptedAndLogged !== true)
    throw new Error("Confirm accepted goods and an AM stock entry");
  const requestHash = hash({
    prId,
    lineId,
    revision: data.revision,
    quantity,
    evidence,
    actor,
  });
  const db = admin.firestore(),
    prRef = db.collection("purchaseRequests").doc(prId),
    policyRef = db.collection("prReceiptOrders").doc(prId);
  const receiptRef = db.collection("am_core_order_receipts").doc(eventId);
  return db.runTransaction(async (tx) => {
    const [prSnap, policySnap, old] = await Promise.all([
      tx.get(prRef),
      tx.get(policyRef),
      tx.get(receiptRef),
    ]);
    if (old.exists) {
      scope(context, old.data()!.ownerId, policySnap.data()?.countryCode, "am");
      if (old.data()!.requestHash !== requestHash)
        throw new Error(
          "Receipt identifier was already used for different content",
        );
      return { receiptId: eventId, replayed: true };
    }
    const pr = prSnap.data(),
      policy = policySnap.data();
    if (
      !pr ||
      !policy ||
      pr.status !== "ORDERED" ||
      pr.pendingAmendment ||
      policy.revision !== data.revision ||
      policy.basisHash !== hash(orderBasis(pr)) ||
      policy.exception
    )
      throw new Error(
        "Order or receipt revision changed; reconcile before receiving",
      );
    scope(context, policy.ownerId, policy.countryCode, "am");
    const lines = policy.lines as ReceiptLine[],
      line = lines.find((l) => l.lineId === lineId);
    if (!line) throw new Error("Unknown approved line");
    const levelRef = db
      .collection("am_core_inventory_levels")
      .doc(line.levelId);
    const [levelSnap, assetSnap] = await Promise.all([
      tx.get(levelRef),
      tx.get(db.collection("am_core_assets").doc(line.assetId)),
    ]);
    const level = levelSnap.data(),
      asset = assetSnap.data();
    if (
      !level ||
      !asset ||
      level.asset_id !== line.assetId ||
      level.location_id !== line.locationId ||
      asset.organization_id !== line.ownerId ||
      unit(asset.unit_of_measure) !== line.unit ||
      !stockItem(asset)
    )
      throw new Error("AM item or destination changed; owner review required");
    const assetTotal = await reconciledStock(tx, line.assetId, asset);
    const newAssetTotal = units(assetTotal + quantity);
    const change = receiptChange(
        line,
        quantity,
        level.quantity_on_hand,
        level.quantity_allocated,
      ),
      now = new Date().toISOString();
    const ledgerId = `pr_receipt_${eventId}`;
    tx.update(db.collection("am_core_assets").doc(line.assetId), {quantity: newAssetTotal, updated_at: now});
    tx.update(levelRef, {
      quantity_on_hand: change.onHand,
      updated_at: now,
      last_receipt_at: now,
    });
    tx.create(db.collection("am_core_transactions").doc(ledgerId), {
      asset_id: line.assetId,
      transaction_type: "StockIngestion",
      quantity_before: assetTotal,
      quantity_after: newAssetTotal,
      quantity,
      transaction_date: now,
      created_at: now,
      performed_by: actor,
      to_location_id: line.locationId,
      source_request_id: prId,
      source_workflow: "pr_order_receipt",
      receipt_id: eventId,
    });
    tx.create(db.collection("am_core_inventory_movements").doc(ledgerId), {
      asset_id: line.assetId,
      part_id: line.assetId,
      qty: quantity,
      movement_type: "receipt",
      to_store: line.locationId,
      from_store: "",
      site_id: line.locationId,
      recorded_at: now,
      occurred_at: now,
      recorded_by: actor,
      reference: prId,
      receipt_id: eventId,
    });
    tx.create(receiptRef, {
      prId,
      lineId,
      revision: policy.revision,
      assetId: line.assetId,
      levelId: line.levelId,
      ownerId: line.ownerId,
      locationId: line.locationId,
      quantity,
      unit: line.unit,
      stockTransactionId: ledgerId,
      stockMovementId: ledgerId,
      evidence,
      recordedBy: actor,
      recordedAt: now,
      requestHash,
      status: "committed",
    });
    tx.update(policyRef, {
      lines: lines.map((l) =>
        l.lineId === lineId ? { ...l, received: change.received } : l,
      ),
      lastReceiptAt: now,
    });
    return {
      receiptId: eventId,
      replayed: false,
      received: change.received,
      ordered: line.ordered,
    };
  });
});

export const completeReceiptControlledPr = handler(async (data, context) => {
  prActor(context, ["process_procurement_queue", "administer_pr"]);
  const db = admin.firestore(),
    prId = id(data.prId),
    ref = db.collection("purchaseRequests").doc(prId),
    policyRef = db.collection("prReceiptOrders").doc(prId);
  const completionNote = note(data.note);
  return db.runTransaction(async (tx) => {
    const [prSnap, policySnap] = await Promise.all([
      tx.get(ref),
      tx.get(policyRef),
    ]);
    const pr = prSnap.data(),
      policy = policySnap.data();
    if (!pr || !policy) throw new Error("Receipt-controlled order not found");
    scope(
      context,
      String(pr.organizationId || pr.organization || ""),
      policy.countryCode,
    );
    if (
      pr.status === "COMPLETED" &&
      !policy.exception &&
      pr.receiptCompletion?.revision === policy.revision
    )
      return { completed: true, replayed: true };
    const check = eligible(pr, policy as ReceiptOrder);
    if (!check.eligible) throw new Error(check.blockers.join("; "));
    if (!(
      (Array.isArray(pr.deliveryNote) && pr.deliveryNote.length) ||
      (typeof pr.deliveryNote === "string" && pr.deliveryNote.trim()) ||
      (Array.isArray(pr.deliveryPhotos) && pr.deliveryPhotos.length) ||
      pr.deliveryDocOverride === true
    ))
      throw new Error("Existing delivery-document requirements still apply");
    const now = new Date().toISOString();
    tx.update(ref, {
      status: "COMPLETED",
      completedAt: now,
      updatedAt: now,
      receiptCompletion: {
        revision: policy.revision,
        at: now,
        by: context.auth!.uid,
      },
      statusHistory: [
        ...(Array.isArray(pr.statusHistory) ? pr.statusHistory : []),
        {
          status: "COMPLETED",
          timestamp: now,
          user: {
            id: context.auth!.uid,
            email: context.auth!.token.email || "",
          },
          notes: completionNote,
        },
      ],
    });
    tx.create(db.collection("prReceiptCloseoutAudit").doc(randomUUID()), {
      prId,
      revision: policy.revision,
      actor: context.auth!.uid,
      at: now,
      note: completionNote,
      lines: policy.lines,
    });
    return { completed: true, replayed: false };
  });
});

export const reverseAmOrderReceipt = handler(async (data, context) => {
  const actor = amActor(context),
    receiptId = id(data.receiptId),
    reason = note(data.reason);
  const db = admin.firestore(),
    receiptRef = db.collection("am_core_order_receipts").doc(receiptId);
  const reverseRef = db.collection("am_core_receipt_reversals").doc(receiptId);
  return db.runTransaction(async (tx) => {
    const [receiptSnap, reversalSnap] = await Promise.all([
      tx.get(receiptRef),
      tx.get(reverseRef),
    ]);
    const receipt = receiptSnap.data();
    if (!receipt) throw new Error("Receipt not found");
    const policyRef = db.collection("prReceiptOrders").doc(receipt.prId),
      prRef = db.collection("purchaseRequests").doc(receipt.prId);
    const levelRef = db
      .collection("am_core_inventory_levels")
      .doc(receipt.levelId);
    const [policySnap, prSnap, levelSnap] = await Promise.all([
      tx.get(policyRef),
      tx.get(prRef),
      tx.get(levelRef),
    ]);
    const policy = policySnap.data(),
      pr = prSnap.data(),
      level = levelSnap.data();
    if (!policy || !pr || !level)
      throw new Error("Receipt reconciliation records are missing");
    scope(context, receipt.ownerId, policy.countryCode, "am");
    if (reversalSnap.exists) return { reversed: true, replayed: true };
    const assetRef = db.collection("am_core_assets").doc(receipt.assetId);
    const asset = (await tx.get(assetRef)).data();
    if (!asset || asset.organization_id !== receipt.ownerId || !stockItem(asset))
      throw new Error("AM item changed; owner review required");
    const assetTotal = await reconciledStock(tx, receipt.assetId, asset);
    const quantity = units(receipt.quantity),
      stock = units(level.quantity_on_hand),
      allocated = units(level.quantity_allocated);
    if (
      level.asset_id !== receipt.assetId ||
      level.location_id !== receipt.locationId ||
      stock - allocated < quantity
    )
      throw new Error(
        "The full received quantity is no longer unallocated at this location; reconcile issues/transfers before reversal",
      );
    const line = (policy.lines as ReceiptLine[]).find(
      (l) => l.lineId === receipt.lineId,
    );
    if (!line || line.received < quantity)
      throw new Error("Receipt totals require reconciliation");
    const now = new Date().toISOString(),
      ledgerId = `pr_return_${receiptId}`;
    tx.update(assetRef, {quantity: units(assetTotal - quantity), updated_at: now});
    tx.update(levelRef, {
      quantity_on_hand: stock - quantity,
      updated_at: now,
    });
    tx.create(reverseRef, {
      receiptId,
      prId: receipt.prId,
      quantity,
      by: actor,
      at: now,
      reason,
      stockTransactionId: ledgerId,
    });
    tx.create(db.collection("am_core_transactions").doc(ledgerId), {
      asset_id: receipt.assetId,
      transaction_type: "Return",
      quantity_before: assetTotal,
      quantity_after: assetTotal - quantity,
      quantity,
      transaction_date: now,
      created_at: now,
      performed_by: actor,
      from_location_id: receipt.locationId,
      source_workflow: "pr_order_receipt_return",
      receipt_id: receiptId,
    });
    tx.create(db.collection("am_core_inventory_movements").doc(ledgerId), {
      asset_id: receipt.assetId,
      part_id: receipt.assetId,
      qty: -quantity,
      movement_type: "return",
      from_store: receipt.locationId,
      to_store: "",
      site_id: receipt.locationId,
      recorded_at: now,
      occurred_at: now,
      recorded_by: actor,
      reference: receipt.prId,
      receipt_id: receiptId,
    });
    const exception =
      pr.status === "COMPLETED"
        ? "AM receipt reversed after completion; commercial closeout requires review"
        : null;
    tx.update(policyRef, {
      lines: (policy.lines as ReceiptLine[]).map((l) =>
        l.lineId === receipt.lineId
          ? { ...l, received: l.received - quantity }
          : l,
      ),
      exception,
    });
    if (exception)
      tx.update(prRef, { receiptException: exception, updatedAt: now });
    return { reversed: true, replayed: false, exception };
  });
});
