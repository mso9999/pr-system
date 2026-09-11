"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseAmOrderReceipt = exports.completeReceiptControlledPr = exports.recordAmOrderReceipt = exports.enrollPrReceiptPilot = void 0;
const country_1 = require("./country");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const crypto_1 = require("crypto");
const policy_1 = require("./policy");
function amActor(context) {
    var _a, _b;
    const token = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token;
    const actions = (_b = (0, policy_1.signedGrant)(token, "am")) === null || _b === void 0 ? void 0 : _b.actions;
    if (!context.auth ||
        (token === null || token === void 0 ? void 0 : token.nexus_sso) !== true ||
        !token.privilegeVersion ||
        !Array.isArray(actions) ||
        !actions.some((a) => ["approve_assets", "administer_assets"].includes(a))) {
        throw new functions.https.HttpsError("permission-denied", "AM approver access through Nexus is required.");
    }
    return context.auth.uid;
}
function prActor(context, required) {
    var _a;
    const grant = (0, policy_1.signedGrant)((_a = context.auth) === null || _a === void 0 ? void 0 : _a.token, "pr");
    if (!context.auth ||
        !grant ||
        !required.some((a) => grant.actions.includes(a)))
        throw new functions.https.HttpsError("permission-denied", "Assigned PR action through Nexus is required");
}
function scope(context, owner, country, system = "pr") {
    var _a;
    const token = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token;
    const p = (0, policy_1.signedGrant)(token, system);
    if (!p ||
        !Array.isArray(p.scopeOrganizations) ||
        !Array.isArray(p.scopeCountries))
        throw new Error("Refresh Nexus sign-in to obtain scope claims");
    if (p.scopeOrganizations.length && !p.scopeOrganizations.includes(owner))
        throw new Error("Organization is outside your assigned scope");
    if (p.scopeCountries.length &&
        (!country || !p.scopeCountries.includes(country)))
        throw new Error("Country is outside your assigned scope");
}
function note(value) {
    if (typeof value !== "string" ||
        value.trim().length < 10 ||
        value.length > 2000)
        throw new Error("Provide a review/evidence note of 10–2000 characters");
    return value.trim();
}
function handler(fn) {
    return functions.https.onCall(async (data, context) => {
        try {
            return await fn(data || {}, context);
        }
        catch (error) {
            if (error instanceof functions.https.HttpsError)
                throw error;
            throw new functions.https.HttpsError("failed-precondition", error instanceof Error ? error.message : "Receipt review failed");
        }
    });
}
// Validate all positions inside the same transaction as the stock mutation.
// Historical discrepancies require a physical reconciliation, never an inferred repair.
async function reconciledStock(tx, assetId, asset) {
    const total = (0, policy_1.units)(asset.quantity);
    const positions = await tx.get(admin.firestore().collection("am_core_inventory_levels").where("asset_id", "==", assetId));
    const locations = new Set();
    let sum = 0;
    if (asset.reconciliation_status && asset.reconciliation_status !== "verified")
        throw new Error("AM stock requires reconciliation before receipt processing");
    for (const position of positions.docs) {
        const row = position.data();
        if (!/^[A-Z]{3}-[A-Z]{2,3}$/.test(row.location_id || "") || locations.has(row.location_id) ||
            (row.reconciliation_status && row.reconciliation_status !== "verified"))
            throw new Error("AM stock requires reconciliation: duplicate, unresolved or unverified location");
        locations.add(row.location_id);
        const onHand = (0, policy_1.units)(row.quantity_on_hand);
        if ((0, policy_1.units)(row.quantity_allocated) > onHand)
            throw new Error("AM stock requires reconciliation: allocation exceeds stock");
        sum += onHand;
    }
    if (!positions.size || sum !== total)
        throw new Error("AM stock requires reconciliation: location totals differ from asset quantity");
    return total;
}
// Explicit prospective enrollment: no mass changes to historical completed orders.
exports.enrollPrReceiptPilot = handler(async (data, context) => {
    prActor(context, ["administer_pr"]);
    const prId = (0, policy_1.id)(data.prId), ownerId = (0, policy_1.id)(data.ownerId), siteDocumentId = (0, policy_1.id)(data.siteDocumentId);
    const evidence = note(data.note);
    if (!Array.isArray(data.lines) ||
        !data.lines.length ||
        data.lines.length > 100)
        throw new Error("Select 1–100 approved goods lines");
    const db = admin.firestore();
    const ref = db.collection("purchaseRequests").doc(prId), policyRef = db.collection("prReceiptOrders").doc(prId);
    return db.runTransaction(async (tx) => {
        const [prSnap, policySnap, siteSnap] = await Promise.all([
            tx.get(ref),
            tx.get(policyRef),
            tx.get(db.collection("referenceData_sites").doc(siteDocumentId)),
        ]);
        const pr = prSnap.data(), site = siteSnap.data();
        if (!pr || pr.status !== "ORDERED" || pr.pendingAmendment)
            throw new Error("Only an unchanged ORDERED PO can enter the receipt pilot");
        if (policySnap.exists)
            throw new Error("Order is already enrolled; amendments require a receipt reconciliation, not re-enrollment");
        const country = site === null || site === void 0 ? void 0 : site.countryCode;
        if (!site ||
            typeof country !== "string" ||
            !/^[A-Z]{2}$/.test(country) ||
            !/^[A-Z]{3}$/.test(site.code || "") ||
            site.active === false ||
            site.organizationId !== ownerId)
            throw new Error("Resolve canonical site country, code, active state and asset owner before enrollment");
        scope(context, String(pr.organizationId || pr.organization || ""), country);
        const destinations = [
            pr.site,
            ...(Array.isArray(pr.sites) ? pr.sites : []),
        ];
        if (!destinations.includes(siteDocumentId))
            throw new Error("The selected destination is not recorded on this order");
        const source = data.lineSource === "po"
            ? pr.lineItemsWithSKU
            : data.lineSource === "request"
                ? pr.lineItems
                : null;
        if (!Array.isArray(source) || source.length !== data.lines.length)
            throw new Error("Every line from the selected approved source must be included; services/mixed orders are not supported by this pilot");
        const seen = new Set();
        const lines = [];
        for (let index = 0; index < source.length; index++) {
            const row = source[index], selection = data.lines[index];
            const lineId = (0, policy_1.id)((row === null || row === void 0 ? void 0 : row.id) || "");
            if (seen.has(lineId))
                throw new Error("Order lines need unique stable IDs before enrollment");
            seen.add(lineId);
            if (selection.lineId !== lineId ||
                selection.specificationVerified !== true)
                throw new Error("Confirm the AM item specification against every approved order line");
            const assetId = (0, policy_1.id)(selection.assetId), levelId = (0, policy_1.id)(selection.levelId);
            const [assetSnap, levelSnap] = await Promise.all([
                tx.get(db.collection("am_core_assets").doc(assetId)),
                tx.get(db.collection("am_core_inventory_levels").doc(levelId)),
            ]);
            const asset = assetSnap.data(), level = levelSnap.data();
            if (!asset ||
                !level ||
                level.asset_id !== assetId ||
                asset.organization_id !== ownerId ||
                !(0, policy_1.stockItem)(asset))
                throw new Error("Select an active AM stock item and its existing inventory position belonging to the asset owner");
            if ((0, policy_1.unit)(asset.unit_of_measure) !== (0, policy_1.unit)(row.uom))
                throw new Error("Exact compatible units are required; kits and substitutions need separate approval");
            // PR code is canonical; AM country/location code must be explicit, never suffix matched.
            const amCountry = await (0, country_1.amCountry)(tx, asset.country_id);
            const iso2 = (amCountry === null || amCountry === void 0 ? void 0 : amCountry.iso2) || (amCountry === null || amCountry === void 0 ? void 0 : amCountry.country_code_2) || (amCountry === null || amCountry === void 0 ? void 0 : amCountry.code);
            if (iso2 !== country)
                throw new Error("AM/PR country identity requires an explicit matching ISO2 value");
            const country3 = amCountry === null || amCountry === void 0 ? void 0 : amCountry.country_code;
            if (typeof country3 !== "string" ||
                level.location_id !== `${country3}-${site.code}`)
                throw new Error("Inventory position must be at the approved canonical site");
            await reconciledStock(tx, assetId, asset);
            const ordered = (0, policy_1.units)(row.quantity);
            if (!ordered)
                throw new Error("Ordered quantities must be positive");
            (0, policy_1.units)(level.quantity_on_hand);
            (0, policy_1.units)(level.quantity_allocated);
            lines.push({
                lineId,
                description: String(row.description || lineId),
                ordered,
                unit: (0, policy_1.unit)(row.uom),
                assetId,
                levelId,
                locationId: level.location_id,
                ownerId,
                received: 0,
            });
        }
        const revision = (0, crypto_1.randomUUID)(), now = new Date().toISOString();
        tx.create(policyRef, {
            revision,
            basisHash: (0, policy_1.hash)((0, policy_1.orderBasis)(pr)),
            lines,
            ownerId,
            countryCode: country,
            siteDocumentId,
            canonicalSiteCode: site.code,
            enrolledBy: context.auth.uid,
            enrolledAt: now,
            note: evidence,
            scope: "prospective_whole_unit_goods_pilot",
        });
        tx.update(ref, { receiptEnforced: true, updatedAt: now });
        return { revision, lines };
    });
});
exports.recordAmOrderReceipt = handler(async (data, context) => {
    const actor = amActor(context), prId = (0, policy_1.id)(data.prId), eventId = (0, policy_1.id)(data.eventId), lineId = (0, policy_1.id)(data.lineId);
    const evidence = note(data.evidence), quantity = (0, policy_1.units)(data.quantity);
    if (!quantity || data.acceptedAndLogged !== true)
        throw new Error("Confirm accepted goods and an AM stock entry");
    const requestHash = (0, policy_1.hash)({
        prId,
        lineId,
        revision: data.revision,
        quantity,
        evidence,
        actor,
    });
    const db = admin.firestore(), prRef = db.collection("purchaseRequests").doc(prId), policyRef = db.collection("prReceiptOrders").doc(prId);
    const receiptRef = db.collection("am_core_order_receipts").doc(eventId);
    return db.runTransaction(async (tx) => {
        var _a;
        const [prSnap, policySnap, old] = await Promise.all([
            tx.get(prRef),
            tx.get(policyRef),
            tx.get(receiptRef),
        ]);
        if (old.exists) {
            scope(context, old.data().ownerId, (_a = policySnap.data()) === null || _a === void 0 ? void 0 : _a.countryCode, "am");
            if (old.data().requestHash !== requestHash)
                throw new Error("Receipt identifier was already used for different content");
            return { receiptId: eventId, replayed: true };
        }
        const pr = prSnap.data(), policy = policySnap.data();
        if (!pr ||
            !policy ||
            pr.status !== "ORDERED" ||
            pr.pendingAmendment ||
            policy.revision !== data.revision ||
            policy.basisHash !== (0, policy_1.hash)((0, policy_1.orderBasis)(pr)) ||
            policy.exception)
            throw new Error("Order or receipt revision changed; reconcile before receiving");
        scope(context, policy.ownerId, policy.countryCode, "am");
        const lines = policy.lines, line = lines.find((l) => l.lineId === lineId);
        if (!line)
            throw new Error("Unknown approved line");
        const levelRef = db
            .collection("am_core_inventory_levels")
            .doc(line.levelId);
        const [levelSnap, assetSnap] = await Promise.all([
            tx.get(levelRef),
            tx.get(db.collection("am_core_assets").doc(line.assetId)),
        ]);
        const level = levelSnap.data(), asset = assetSnap.data();
        if (!level ||
            !asset ||
            level.asset_id !== line.assetId ||
            level.location_id !== line.locationId ||
            asset.organization_id !== line.ownerId ||
            (0, policy_1.unit)(asset.unit_of_measure) !== line.unit ||
            !(0, policy_1.stockItem)(asset))
            throw new Error("AM item or destination changed; owner review required");
        const assetTotal = await reconciledStock(tx, line.assetId, asset);
        const newAssetTotal = (0, policy_1.units)(assetTotal + quantity);
        const change = (0, policy_1.receiptChange)(line, quantity, level.quantity_on_hand, level.quantity_allocated), now = new Date().toISOString();
        const ledgerId = `pr_receipt_${eventId}`;
        tx.update(db.collection("am_core_assets").doc(line.assetId), { quantity: newAssetTotal, updated_at: now });
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
            lines: lines.map((l) => l.lineId === lineId ? Object.assign(Object.assign({}, l), { received: change.received }) : l),
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
exports.completeReceiptControlledPr = handler(async (data, context) => {
    prActor(context, ["process_procurement_queue", "administer_pr"]);
    const db = admin.firestore(), prId = (0, policy_1.id)(data.prId), ref = db.collection("purchaseRequests").doc(prId), policyRef = db.collection("prReceiptOrders").doc(prId);
    const completionNote = note(data.note);
    return db.runTransaction(async (tx) => {
        var _a;
        const [prSnap, policySnap] = await Promise.all([
            tx.get(ref),
            tx.get(policyRef),
        ]);
        const pr = prSnap.data(), policy = policySnap.data();
        if (!pr || !policy)
            throw new Error("Receipt-controlled order not found");
        scope(context, String(pr.organizationId || pr.organization || ""), policy.countryCode);
        if (pr.status === "COMPLETED" &&
            !policy.exception &&
            ((_a = pr.receiptCompletion) === null || _a === void 0 ? void 0 : _a.revision) === policy.revision)
            return { completed: true, replayed: true };
        const check = (0, policy_1.eligible)(pr, policy);
        if (!check.eligible)
            throw new Error(check.blockers.join("; "));
        if (!((Array.isArray(pr.deliveryNote) && pr.deliveryNote.length) ||
            (typeof pr.deliveryNote === "string" && pr.deliveryNote.trim()) ||
            (Array.isArray(pr.deliveryPhotos) && pr.deliveryPhotos.length) ||
            pr.deliveryDocOverride === true))
            throw new Error("Existing delivery-document requirements still apply");
        const now = new Date().toISOString();
        tx.update(ref, {
            status: "COMPLETED",
            completedAt: now,
            updatedAt: now,
            receiptCompletion: {
                revision: policy.revision,
                at: now,
                by: context.auth.uid,
            },
            statusHistory: [
                ...(Array.isArray(pr.statusHistory) ? pr.statusHistory : []),
                {
                    status: "COMPLETED",
                    timestamp: now,
                    user: {
                        id: context.auth.uid,
                        email: context.auth.token.email || "",
                    },
                    notes: completionNote,
                },
            ],
        });
        tx.create(db.collection("prReceiptCloseoutAudit").doc((0, crypto_1.randomUUID)()), {
            prId,
            revision: policy.revision,
            actor: context.auth.uid,
            at: now,
            note: completionNote,
            lines: policy.lines,
        });
        return { completed: true, replayed: false };
    });
});
exports.reverseAmOrderReceipt = handler(async (data, context) => {
    const actor = amActor(context), receiptId = (0, policy_1.id)(data.receiptId), reason = note(data.reason);
    const db = admin.firestore(), receiptRef = db.collection("am_core_order_receipts").doc(receiptId);
    const reverseRef = db.collection("am_core_receipt_reversals").doc(receiptId);
    return db.runTransaction(async (tx) => {
        const [receiptSnap, reversalSnap] = await Promise.all([
            tx.get(receiptRef),
            tx.get(reverseRef),
        ]);
        const receipt = receiptSnap.data();
        if (!receipt)
            throw new Error("Receipt not found");
        const policyRef = db.collection("prReceiptOrders").doc(receipt.prId), prRef = db.collection("purchaseRequests").doc(receipt.prId);
        const levelRef = db
            .collection("am_core_inventory_levels")
            .doc(receipt.levelId);
        const [policySnap, prSnap, levelSnap] = await Promise.all([
            tx.get(policyRef),
            tx.get(prRef),
            tx.get(levelRef),
        ]);
        const policy = policySnap.data(), pr = prSnap.data(), level = levelSnap.data();
        if (!policy || !pr || !level)
            throw new Error("Receipt reconciliation records are missing");
        scope(context, receipt.ownerId, policy.countryCode, "am");
        if (reversalSnap.exists)
            return { reversed: true, replayed: true };
        const assetRef = db.collection("am_core_assets").doc(receipt.assetId);
        const asset = (await tx.get(assetRef)).data();
        if (!asset || asset.organization_id !== receipt.ownerId || !(0, policy_1.stockItem)(asset))
            throw new Error("AM item changed; owner review required");
        const assetTotal = await reconciledStock(tx, receipt.assetId, asset);
        const quantity = (0, policy_1.units)(receipt.quantity), stock = (0, policy_1.units)(level.quantity_on_hand), allocated = (0, policy_1.units)(level.quantity_allocated);
        if (level.asset_id !== receipt.assetId ||
            level.location_id !== receipt.locationId ||
            stock - allocated < quantity)
            throw new Error("The full received quantity is no longer unallocated at this location; reconcile issues/transfers before reversal");
        const line = policy.lines.find((l) => l.lineId === receipt.lineId);
        if (!line || line.received < quantity)
            throw new Error("Receipt totals require reconciliation");
        const now = new Date().toISOString(), ledgerId = `pr_return_${receiptId}`;
        tx.update(assetRef, { quantity: (0, policy_1.units)(assetTotal - quantity), updated_at: now });
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
        const exception = pr.status === "COMPLETED"
            ? "AM receipt reversed after completion; commercial closeout requires review"
            : null;
        tx.update(policyRef, {
            lines: policy.lines.map((l) => l.lineId === receipt.lineId
                ? Object.assign(Object.assign({}, l), { received: l.received - quantity }) : l),
            exception,
        });
        if (exception)
            tx.update(prRef, { receiptException: exception, updatedAt: now });
        return { reversed: true, replayed: false, exception };
    });
});
//# sourceMappingURL=service.js.map