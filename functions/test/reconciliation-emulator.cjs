const assert=require('node:assert/strict');
if(!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:'))throw Error('Local emulator required');
const admin=require('firebase-admin');admin.initializeApp({projectId:'demo-pr-am-reconciliation'});const db=admin.firestore();
const fn=require('../lib/receipts/reconciliation').saveAmReconciliation;
const ctx={auth:{uid:'approver',token:{nexus_sso:true,privilegeVersion:'test',systems:{am:{actions:['approve_assets'],scopeCountries:['LS'],scopeOrganizations:['1pwr_lesotho']}}}}};
const identity=a=>({name:a.name||'',unit:a.unit_of_measure||'',ugpPartId:a.ugp_part_id||'',definitionId:a.definition_id||'',manufacturer:a.manufacturer||'',model:a.model||'',description:a.description||''});
(async()=>{
 await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-pr-am-reconciliation/databases/(default)/documents`,{method:'DELETE'});
 await db.doc('pr_master_countries/LSO').set({country_id:'1',iso2:'LS',country_code:'LSO'});
 const a={name:'Legacy clamp',description:'Old description',unit_of_measure:'EA',item_class:'Inventory',status:'Available',country_id:'1',organization_id:'1pwr_lesotho',quantity:25};
 await db.doc('am_core_assets/a').set(a);await db.doc('am_core_assets/b').set({...a,name:'Other spelling'});
 await db.doc('am_part_media/photo').set({asset_id:'a',approved:true});
 const body={eventId:'event1',ugpPartId:'abc-dead-end-clamp',assetIds:['a','b'],decision:'same_part',expectedAssets:{a:identity(a),b:identity({...a,name:'Other spelling'})},evidence:'Manufacturer datasheet and physical item were checked.',retParticipant:'RET reviewer',retVerified:true,amVerified:true,currentSpecificationVerified:true};
 await assert.rejects(fn.run({...body,retVerified:false},ctx));
 await assert.rejects(fn.run(body,{auth:{...ctx.auth,token:{...ctx.auth.token,systems:{am:{actions:['operate_assets']}}}}}));
 await assert.rejects(fn.run({...body,expectedAssets:{a:identity({...a,name:'Stale'}),b:body.expectedAssets.b}},ctx));
 const result=await fn.run(body,ctx);assert.equal(result.published,true);
 const saved=(await db.doc('am_core_assets/a').get()).data();assert.equal(saved.quantity,25);assert.equal(saved.name,'ABC Dead-End Clamp');assert.equal(saved.canonical_part_number,'abc-dead-end-clamp');assert.deepEqual(saved.catalogue_aliases,['Legacy clamp']);
 assert.equal((await db.doc('am_part_definitions/ugp-abc-dead-end-clamp').get()).get('canonical_approved'),true);
 assert.equal((await db.doc('am_part_media/photo').get()).get('definition_id'),'ugp-abc-dead-end-clamp');
 assert.equal((await fn.run(body,ctx)).unchanged,true);
 await assert.rejects(fn.run({...body,evidence:'A different request must not reuse the event identifier.'},ctx));
 const deferred={...body,eventId:'event2',assetIds:[],expectedAssets:{},decision:'need_photo',ownerName:'Store lead',dueDate:'2026-10-01'};
 assert.equal((await fn.run(deferred,ctx)).published,false);assert.equal((await db.doc('am_catalogue_tasks/event2').get()).get('status'),'open');
 await assert.rejects(fn.run({...deferred,eventId:'event3',ownerName:''},ctx));
 await db.doc('am_core_assets/c').set({...a,organization_id:'1pwr_zambia'});
 await assert.rejects(fn.run({...body,eventId:'outside',assetIds:['c'],expectedAssets:{c:identity(a)}},ctx));
 // Missing organization_id must resolve from Lesotho country (matches AM PHP).
 await db.doc('am_core_assets/d').set({name:'Legacy clamp',description:'Old description',unit_of_measure:'EA',item_class:'Inventory',status:'Available',country_id:'1',quantity:25});
 assert.equal((await fn.run({...body,eventId:'no-org',assetIds:['d'],expectedAssets:{d:identity(a)}},ctx)).published,true);
 // Unrecognized grant org ids must not block LS stock (AM PHP ignores them and defaults).
 const noisyCtx={auth:{uid:'approver',token:{nexus_sso:true,privilegeVersion:'test',systems:{am:{actions:['approve_assets'],scopeCountries:['LS'],scopeOrganizations:['smp','dept-uuid']}}}}};
 await db.doc('am_core_assets/e').set(a);
 assert.equal((await fn.run({...body,eventId:'noisy-org',assetIds:['e'],expectedAssets:{e:identity(a)}},noisyCtx)).published,true);
 await db.doc('am_core_assets/c').set({...a,unit_of_measure:'kit'});
 await assert.rejects(fn.run({...body,eventId:'units',assetIds:['c'],expectedAssets:{c:identity({...a,unit_of_measure:'kit'})}},ctx));
 // IDs containing dimensions are legal UGP numbers.
 await db.doc('am_core_assets/c').set(a);
 assert.equal((await fn.run({...body,eventId:'decimal',ugpPartId:'cross-arm-mv-2.5m',assetIds:['c'],expectedAssets:{c:identity(a)}},ctx)).published,true);
 const jwt=[Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({aud:'demo-pr-am-reconciliation',iss:'https://securetoken.google.com/demo-pr-am-reconciliation',sub:'approver',user_id:'approver',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,firebase:{sign_in_provider:'custom'},...ctx.auth.token})).toString('base64url'),''].join('.');
 const patch=async(path,fields)=>fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-pr-am-reconciliation/databases/(default)/documents/${path}?${Object.keys(fields).map(k=>'updateMask.fieldPaths='+k).join('&')}`,{method:'PATCH',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({fields})});
 assert.equal((await patch('am_part_definitions/ugp-abc-dead-end-clamp',{name:{stringValue:'Bypass'}})).status,403);
 assert.equal((await patch('am_core_assets/a',{name:{stringValue:'Bypass'}})).status,403);
 console.log('PASS: joint attestations, scope, stale evidence, atomic identity/alias/photo publication, retries, exceptions, dimension IDs and direct-write guards');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>admin.app().delete());
