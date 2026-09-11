// Run only via the Firestore emulator against the dedicated demo project.
const assert = require("node:assert/strict");
const admin = require("firebase-admin");
if (
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !process.env.FIRESTORE_EMULATOR_HOST.startsWith("127.0.0.1:")
)
  throw new Error("Local emulator required");
const projectId = "demo-pr-am-receipts";
admin.initializeApp({ projectId });
const db = admin.firestore();
const svc = require("../lib/receipts/service");
const mapping = require("../lib/receipts/mapping");
const refs = require("../lib/receipts/masMappingReview.json");
const context = (system, actions, owner = "smp") => ({
  auth: {
    uid: system,
    token: {
      email: system + "@example.test",
      nexus_sso: true,
      targetSystem: system,
      privilegeVersion: "test",
      effectivePrivilege: {
        actions,
        scopeCountries: ["LS"],
        scopeOrganizations: [owner],
      },
    },
  },
});
const pr = context("pr", ["administer_pr"]),
  am = context("am", ["approve_assets"]);
// Firebase refresh tokens carry persisted systems grants without targetSystem.
am.auth.token.systems = { am: am.auth.token.effectivePrivilege };
delete am.auth.token.effectivePrivilege;
delete am.auth.token.targetSystem;
const call = (fn, data, ctx) => fn.run(data, ctx);
(async () => {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  await db.doc("users/pr").set({ permissionLevel: 1 });
  await db
    .doc("referenceData_sites/mashai_smp")
    .set({
      code: "MAS",
      countryCode: "LS",
      active: true,
      organizationId: "smp",
    });
  await db
    .doc("pr_master_countries/LSO")
    .set({ country_id: "1", iso2: "LS", country_code: "LSO" });
  await db
    .doc("am_core_assets/asset")
    .set({
      quantity: 0,
      item_class: "Material",
      unit_of_measure: "EA",
      organization_id: "smp",
      country_id: "1",
      active: true,
    });
  await db
    .doc("am_core_inventory_levels/level")
    .set({
      asset_id: "asset",
      location_id: "LSO-MAS",
      quantity_on_hand: 0,
      quantity_allocated: 0,
    });
  await db
    .doc("purchaseRequests/po")
    .set({
      requestorId: "pr",
      status: "ORDERED",
      organization: "smp",
      site: "mashai_smp",
      lineItems: [
        { id: "clamps", description: "Clamps", quantity: 100, uom: "PCS" },
      ],
      deliveryPhotos: ["evidence"],
    });
  const enroll = {
    prId: "po",
    ownerId: "smp",
    siteDocumentId: "mashai_smp",
    lineSource: "request",
    note: "Approved whole-unit goods pilot",
    lines: [
      {
        lineId: "clamps",
        assetId: "asset",
        levelId: "level",
        specificationVerified: true,
      },
    ],
  };
  await db.doc("am_core_inventory_levels/duplicate").set({asset_id:"asset",location_id:"LSO-MAS",quantity_on_hand:0,quantity_allocated:0});
  await assert.rejects(call(svc.enrollPrReceiptPilot,enroll,pr),/reconciliation/);
  await db.doc("am_core_inventory_levels/duplicate").delete();
  await db.doc("pr_master_countries/duplicate").set({country_id:"1",iso2:"LS",country_code:"LSO"});
  await assert.rejects(call(svc.enrollPrReceiptPilot,enroll,pr),/ambiguous/);
  await db.doc("pr_master_countries/duplicate").delete();
  const policy = await call(svc.enrollPrReceiptPilot, enroll, pr);
  const receipt = {
    prId: "po",
    lineId: "clamps",
    revision: policy.revision,
    eventId: "event1",
    quantity: 60,
    evidence: "Delivery note 001 accepted clamps",
    acceptedAndLogged: true,
  };
  await assert.rejects(
    call(svc.recordAmOrderReceipt, receipt, pr),
    /AM approver/,
  );
  await assert.rejects(
    call(
      svc.recordAmOrderReceipt,
      receipt,
      context("am", ["approve_assets"], "neo1"),
    ),
    /outside/,
  );
  for (const bad of [
    {location_id:"LSO-HQ",quantity_on_hand:1},
    {location_id:"LSO-MAS",quantity_on_hand:0},
    {location_id:"site1",quantity_on_hand:0},
    {location_id:"LSO-HQ",quantity_on_hand:0,reconciliation_status:"unverified"}
  ]) {
    await db.doc("am_core_inventory_levels/bad").set({asset_id:"asset",quantity_allocated:0,...bad});
    await assert.rejects(call(svc.recordAmOrderReceipt,receipt,am),/reconciliation/);
    assert.equal((await db.doc("am_core_assets/asset").get()).data().quantity,0);
    assert.equal((await db.doc("am_core_order_receipts/event1").get()).exists,false);
    await db.doc("am_core_inventory_levels/bad").delete();
  }
  await Promise.all([
    call(svc.recordAmOrderReceipt, receipt, am),
    call(svc.recordAmOrderReceipt, receipt, am),
  ]);
  assert.equal(
    (await db.doc("am_core_inventory_levels/level").get()).data()
      .quantity_on_hand,
    60,
  );
  assert.equal((await db.collection("am_core_order_receipts").get()).size, 1);
  assert.equal((await db.doc("am_core_assets/asset").get()).data().quantity,60);
  await assert.rejects(
    call(svc.recordAmOrderReceipt, { ...receipt, quantity: 61 }, am),
    /different content/,
  );
  await assert.rejects(
    call(
      svc.completeReceiptControlledPr,
      { prId: "po", note: "Order completion requested" },
      pr,
    ),
    /60 of 100/,
  );
  await assert.rejects(
    call(
      svc.recordAmOrderReceipt,
      { ...receipt, eventId: "over", quantity: 41 },
      am,
    ),
    /Overdelivery/,
  );
  assert.equal(
    (await db.doc("am_core_inventory_levels/level").get()).data()
      .quantity_on_hand,
    60,
  );
  // A ledger collision aborts the whole commit, including balances and coverage.
  await db.doc("am_core_transactions/pr_receipt_collision").set({testCollision:true});
  await assert.rejects(call(svc.recordAmOrderReceipt,{...receipt,eventId:"collision",quantity:1},am));
  assert.equal((await db.doc("am_core_inventory_levels/level").get()).data().quantity_on_hand,60);
  assert.equal((await db.doc("am_core_order_receipts/collision").get()).exists,false);
  const originalOrder=(await db.doc("purchaseRequests/po").get()).data();
  await db.doc("purchaseRequests/po").update({lineItems:[{id:"clamps",description:"Changed specification",quantity:100,uom:"PCS"}]});
  await assert.rejects(call(svc.recordAmOrderReceipt,{...receipt,eventId:"stale",quantity:40},am),/revision changed/);
  await db.doc("purchaseRequests/po").update({lineItems:originalOrder.lineItems});
  await call(
    svc.recordAmOrderReceipt,
    { ...receipt, eventId: "event2", quantity: 40 },
    am,
  );
  await call(
    svc.completeReceiptControlledPr,
    { prId: "po", note: "Order completion requested" },
    pr,
  );
  assert.equal(
    (await db.doc("purchaseRequests/po").get()).data().status,
    "COMPLETED",
  );
  assert.equal((await db.doc("am_core_assets/asset").get()).data().quantity,100);
  await db.doc("am_core_assets/asset").update({quantity:101});
  await assert.rejects(call(svc.reverseAmOrderReceipt,{receiptId:"event2",reason:"Goods returned in full to supplier"},am),/reconciliation/);
  await db.doc("am_core_assets/asset").update({quantity:100});
  await call(
    svc.reverseAmOrderReceipt,
    { receiptId: "event2", reason: "Goods returned in full to supplier" },
    am,
  );
  await call(
    svc.reverseAmOrderReceipt,
    { receiptId: "event2", reason: "Duplicate retry of supplier return" },
    am,
  );
  assert.equal(
    (await db.doc("am_core_inventory_levels/level").get()).data()
      .quantity_on_hand,
    60,
  );
  assert.equal((await db.doc("am_core_assets/asset").get()).data().quantity,60);
  assert.match(
    (await db.doc("purchaseRequests/po").get()).data().receiptException,
    /reversed/,
  );
  await assert.rejects(
    call(
      svc.completeReceiptControlledPr,
      { prId: "po", note: "Order completion requested" },
      pr,
    ),
    /reversed|ORDERED/,
  );
  // Mapping has a separate verified AM write; name matching never calls this automatically.
  const [partId, part] = Object.entries(refs.parts).find(
    ([, p]) =>
      p.category === "candidate" && p.candidateIds.length && p.unit === "piece",
  );
  const assetId = part.candidateIds[0];
  await db
    .doc("am_core_assets/" + assetId)
    .set({
      item_class: "Material",
      unit_of_measure: "EA",
      organization_id: "smp",
      country_id: "1",
      active: true,
    });
  const map = {
    assetId,
    ugpPartId: partId,
    expectedUgpPartId: null,
    specificationVerified: true,
    canonicalPartVerified: true,
    evidence:
      "Manufacturer specification and canonical UGP dimensions checked by AM owner",
  };
  await assert.rejects(
    call(
      mapping.confirmAmUgpMapping,
      { ...map, specificationVerified: false },
      am,
    ),
    /Confirm/,
  );
  await call(mapping.confirmAmUgpMapping, map, am);
  assert.equal(
    (await db.doc("am_core_assets/" + assetId).get()).data().ugp_part_id,
    partId,
  );
  assert.equal((await db.collection("am_core_mapping_reviews").get()).size, 1);
  // Rules use unsigned emulator-only Firebase JWTs; these are never production credentials.
  const jwt = (ctx) =>
    [
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          iss: `https://securetoken.google.com/${projectId}`,
          aud: projectId,
          sub: ctx.auth.uid,
          user_id: ctx.auth.uid,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          firebase: { sign_in_provider: "custom" },
          ...ctx.auth.token,
        }),
      ).toString("base64url"),
      "",
    ].join(".");
  const patch = async (path, fields, ctx) =>
    fetch(
      `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${path}?${Object.keys(
        fields,
      )
        .map((k) => "updateMask.fieldPaths=" + k)
        .join("&")}`,
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + jwt(ctx),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      },
    );
  await db.doc("purchaseRequests/po").update({ status: "ORDERED" });
  assert.equal(
    (
      await patch(
        "purchaseRequests/po",
        { status: { stringValue: "COMPLETED" } },
        pr,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await patch(
        "purchaseRequests/po",
        { receiptEnforced: { booleanValue: false } },
        pr,
      )
    ).status,
    403,
  );
  assert.equal(
    (await patch("prReceiptOrders/po", { exception: { nullValue: null } }, pr))
      .status,
    403,
  );
  assert.equal(
    (
      await patch(
        "am_core_assets/" + assetId,
        { ugp_part_id: { stringValue: "forged" } },
        am,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await patch(
        "purchaseRequests/po",
        { notes: { stringValue: "Legitimate unrelated edit" } },
        pr,
      )
    ).status,
    200,
  );
  console.log(
    "PASS: atomic receipts, concurrent retries, partial/overdelivery gates, scope/auth, completion, reversal, verified mapping, direct-client bypass rules",
  );
  await admin.app().delete();
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode || 0), 250));
