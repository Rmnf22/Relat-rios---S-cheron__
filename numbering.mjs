import assert from 'node:assert/strict';
import {newReport,validateReport,clone} from '../site/model.js';
import {updateSuggestedNumber,resetNumbering,generateDefinitive,NumberingClient,validateCatalog} from '../site/numbering.js';

const catalog=validateCatalog({records:[{sheet:'FieldService',sequence:41},{sheet:'ServiceCenter',sequence:71}]});
const make=()=>{const r=newReport();Object.assign(r.meta,{date:'2026-10-17',client:'CLIENTE TESTE',project:'PROJETO TESTE',author:'TÉCNICO TESTE',location:'LOCAL TESTE',scope:'Serviço fictício para teste'});updateSuggestedNumber(r,catalog);return r;};
const receipt=(p,number='043F1026')=>({requestId:p.requestId,status:'registered',number,revision:'00',sheet:p.metadata.kind==='center'?'ServiceCenter':'FieldService',row:49,registeredAt:'2026-10-17T15:00:00Z'});
let r=make();assert.equal(r.meta.number,'042F1026');r.meta.kind='center';updateSuggestedNumber(r,catalog);assert.equal(r.meta.number,'072L1026');r.meta.kind='field';updateSuggestedNumber(r,catalog);assert.equal(r.meta.number,'042F1026');assert.equal(r.numbering.status,'draft');
const noData=make();updateSuggestedNumber(noData,{records:[],ready:false});assert.equal(noData.meta.number,'','No guessed sequence without a source');

let writes=0,renders=0,saves=0;
const deps={configured:true,online:true,save:async()=>{saves++;return true;},render:async r=>{renders++;return {snapshot:clone(r),bytes:new Uint8Array([1])};},submit:async p=>{writes++;return receipt(p);}};
await assert.rejects(generateDefinitive(make(),{...deps,configured:false}),/conectada/);
await assert.rejects(generateDefinitive(make(),{...deps,online:false}),/internet/);
await assert.rejects(generateDefinitive(make(),{...deps,render:async()=>{throw Error('bad image');}}),/bad image/);
assert.equal(writes,0);assert.equal(saves,0);
const incomplete=make();incomplete.meta.author='';await assert.rejects(generateDefinitive(incomplete,deps),/Elaborado/);assert.equal(writes,0);

// A competing technician used 42: only the number CONFIRMED by the API goes to the final PDF.
r=make();const snapshots=[];let release;const gate=new Promise(resolve=>release=resolve);
const p1=generateDefinitive(r,{...deps,render:async snap=>{snapshots.push(clone(snap));return {snapshot:clone(snap)};},submit:async payload=>{writes++;await gate;return receipt(payload);}});
const p2=generateDefinitive(r,deps);assert.equal(p1,p2,'Double-click shares one active operation');
release();const out=await p1;assert.equal(writes,1);assert.equal(out.snapshot.meta.number,'043F1026');assert.equal(out.snapshot.settings.draft,false);assert.equal(snapshots[0].settings.draft,true);assert.equal(r.numbering.status,'registered');assert.equal(saves,2);
await generateDefinitive(r,{...deps,online:false});assert.equal(writes,1,'Re-download offline never creates another row');

// Lost response after a hypothetical server commit: the exact key and payload are reused.
const requests=[];r=make();let counter=0;const committed=new Map();
const lostResponse=async p=>{requests.push(clone(p));if(!committed.has(p.requestId))committed.set(p.requestId,receipt(p));if(counter++===0)throw Error('response lost');return committed.get(p.requestId);};
await assert.rejects(generateDefinitive(r,{...deps,submit:lostResponse}),/response lost/);assert.equal(r.numbering.status,'pending');
const restored=validateReport(JSON.parse(JSON.stringify(r)));assert.equal(restored.numbering.requestId,r.numbering.requestId);
await generateDefinitive(restored,{...deps,submit:lostResponse});assert.deepEqual(requests[0],requests[1]);assert.equal(committed.size,1);assert.equal(restored.numbering.status,'registered');
const recovered=validateReport(JSON.parse(JSON.stringify(restored)));await generateDefinitive(recovered,{...deps,submit:()=>{throw Error('Must not write');},online:false});
resetNumbering(recovered);assert.notEqual(recovered.numbering.requestId,restored.numbering.requestId);assert.equal(recovered.numbering.status,'draft');assert.equal(recovered.meta.number,'');

// A render failure after confirmation keeps the receipt and does not allocate again.
r=make();let renderCalls=0,commits=0;
await assert.rejects(generateDefinitive(r,{...deps,submit:async p=>{commits++;return receipt(p);},render:async()=>{if(++renderCalls===2)throw Error('render failed');return {};}}),/render failed/);
assert.equal(r.numbering.status,'registered');await generateDefinitive(r,{...deps,submit:()=>{throw Error('Must not write');}});assert.equal(commits,1);

// A success-shaped response with the wrong area is never treated as a valid confirmation.
r=make();await assert.rejects(generateDefinitive(r,{...deps,submit:async p=>receipt(p,'043L1026')}),/área/);assert.equal(r.numbering.status,'pending');
const requestId=r.numbering.requestId;r.meta.client='CHANGED';await assert.rejects(generateDefinitive(r,deps),/alterados/);assert.equal(r.numbering.requestId,requestId);

let calls=[];
const client=new NumberingClient({apiBaseUrl:'https://api.example.invalid/reports/'},{fetcher:async(url,opts)=>{calls.push({url,opts});return {ok:true,status:200,json:async()=>calls.length===1?{records:catalog.records}:receipt(JSON.parse(opts.body))};}});
await client.catalog();assert.equal(calls[0].opts.method,undefined);assert.equal(calls[0].opts.cache,'no-store');assert.equal(calls[0].opts.credentials,'include');
const payload=make();await client.issue({requestId:payload.numbering.requestId,metadata:payload.meta});assert.equal(calls[1].opts.method,'POST');assert.equal(calls[1].opts.headers['Idempotency-Key'],payload.numbering.requestId);
assert.equal(new NumberingClient({apiBaseUrl:'https://api.example.invalid'},{portable:true}).enabled,false);
await assert.rejects(new NumberingClient({apiBaseUrl:'http://unsafe.invalid'}).catalog(),/HTTPS/);
console.log('Numbering: separate F/L previews; no write before definitive action; preflight; duplicate-click protection; confirmed number; retry identity; JSON recovery; re-download and offline behavior passed against a simulated API.');
console.log('Production Excel/SharePoint access and server serialization are not configured or validated.');
