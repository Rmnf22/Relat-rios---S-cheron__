import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=await fs.readFile(path.join(root,'Abrir_Gerador_Offline.html'),'utf8');
assert.ok(!/<(?:script|link)\b[^>]*(?:src|href)=["'](?!data:)[^"']+["']/i.test(html),'Portable file must not load external JS or CSS.');
assert.ok(!/type="module"/.test(html));
const scripts=Array.from(html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g),m=>m[1]);assert.equal(scripts.length,3);
let requests=0,storageCalls=0,downloads=0;const elements=new Map(),handlers={};
function elem(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',style:{},classList:{toggle(){}},showModal(){this.open=true;},close(){this.open=false;},click(){downloads++;},append(){},remove(){}});return elements.get(id);}
const context={console,URL,Blob,File,Date,Intl,Uint8Array,Uint16Array,Uint32Array,Int32Array,Float64Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,atob,btoa,crypto:globalThis.crypto,setTimeout:()=>1,clearTimeout(){},navigator:{onLine:false},location:{protocol:'file:'},document:{getElementById:elem,querySelectorAll:()=>[],querySelector:()=>null,createElement:()=>elem('anchor'),body:{append(){}},addEventListener:(k,fn)=>handlers[k]=fn},window:{scrollTo(){},addEventListener(){}},fetch:()=>{requests++;throw new Error('Network intentionally disabled');},indexedDB:{open(){storageCalls++;throw new Error('No file storage');}},localStorage:{getItem(){storageCalls++;throw new Error('No file storage');},setItem(){storageCalls++;throw new Error('No file storage');}}};
vm.createContext(context);
for(let i=0;i<scripts.length;i++){let s=scripts[i];if(i===2)s=s.replace(/\ninit\(\);\s*\n/,`\nglobalThis.qa={init,getPdf,persist,dbAction,report:()=>report,blocks:newSection,codeFor,filenameFor,saved:()=>saved,setCatalog:x=>{catalog=x;syncNumberPreview();shell();}};\n`);vm.runInContext(s,context);}
await context.qa.init();assert.ok(elem('view').innerHTML.includes('Relatório técnico'));assert.ok(elem('app').innerHTML.includes('Sessão temporária'));assert.equal(storageCalls,0);assert.equal(requests,0);
const click=(action,extra={})=>handlers.click({target:{closest:()=>({dataset:{action,...extra},disabled:false})}});
let r=context.qa.report();Object.assign(r.meta,{number:'041F1026',client:'CLIENTE DE TESTE',project:'PROJETO-TESTE',location:'LOCAL DE TESTE',scope:'Validação de distribuição offline. Dados fictícios.',author:'Técnico de teste'});
context.qa.setCatalog({ready:true,records:[{sheet:'FieldService',sequence:41},{sheet:'ServiceCenter',sequence:71}]});assert.equal(r.meta.number,'042F1026');assert.equal(requests,0);
const originalId=r.id;await click('preset',{key:'isolation'});assert.equal(r.sections.length,3);const t=r.sections[2].blocks[1];await click('table-add-row',{block:t.id});assert.equal(t.rows.length,2);
handlers.input({target:{dataset:{table:t.id,row:'0',col:'0'},value:'Medição de teste'}});assert.equal(t.rows[0][0],'Medição de teste');
await context.qa.persist();assert.equal(context.qa.saved(),false);const result=await context.qa.getPdf();assert.ok(result.bytes.length>1000);assert.equal(requests,0);
await click('pdf-draft');assert.equal(downloads,1);assert.equal(requests,0);
await click('pdf-final');assert.equal(downloads,1);assert.equal(requests,0);assert.ok(elem('toast').textContent.includes('conectada'));
await click('backup');assert.equal(downloads,2);assert.equal(context.qa.saved(),true);
await click('new-kind',{kind:'center'});assert.notEqual(context.qa.report().id,originalId);assert.equal(context.qa.report().meta.kind,'center');assert.equal(context.qa.report().meta.number,'072L1026');
const prior=await context.qa.dbAction('readonly',s=>s.get(originalId));assert.equal(prior.meta.client,'CLIENTE DE TESTE');
await click('open-report',{id:originalId});assert.equal(context.qa.report().id,originalId);assert.equal(requests,0);assert.equal(storageCalls,0);
console.log(`Portable: PDF ${result.pageCount} pages, new/open/export working; zero network or file-storage calls.`);

// Exercise the real service-worker source with an in-memory cache and a
// deliberately disconnected fetch, under a GitHub Pages subdirectory.
const sw=await fs.readFile(path.join(root,'site/sw.js'),'utf8');const cacheData=new Map(),swHandlers={};let skip=0,claimed=0;const scope='https://example.invalid/relatorios/';
const caches={async keys(){return [...cacheData.keys()];},async delete(k){return cacheData.delete(k);},async open(k){if(!cacheData.has(k))cacheData.set(k,new Map());const m=cacheData.get(k);return {async addAll(reqs){for(const req of reqs){const pathname=new URL(req.url).pathname.replace('/relatorios/','');const content=await fs.readFile(path.join(root,'site',pathname||'index.html'));m.set(req.url,new Response(content));}},async match(req,{ignoreSearch=false}={}){let url=typeof req==='string'?req:req.url;if(ignoreSearch){const u=new URL(url);u.search='';url=u.href;}return m.get(url)?.clone();}};}};
const prefix='secheron-reports-'+encodeURIComponent('/relatorios/')+'-';cacheData.set(prefix+'old',new Map());cacheData.set('unrelated-app-cache',new Map());
const swContext={URL,Request,Response,caches,fetch:()=>{throw new Error('Offline');},self:{registration:{scope},clients:{claim:async()=>claimed++},skipWaiting:()=>skip++,addEventListener:(event,fn)=>swHandlers[event]=fn}};
vm.createContext(swContext);vm.runInContext(sw,swContext);
let work;swHandlers.install({waitUntil:p=>work=p});await work;assert.equal(skip,0);swHandlers.activate({waitUntil:p=>work=p});await work;assert.equal(claimed,1);assert.ok(cacheData.has('unrelated-app-cache'));assert.ok(!cacheData.has(prefix+'old'));
for(const resource of ['index.html','app.js','model.js','pdf.js','xlsx.js','assets.js','offline.js','numbering-config.js','numbering.js','vendor/pdf-lib.min.js','assets/secheron.jpg','manifest.webmanifest','assets/icon-192.png','assets/icon-512.png']){
 let response;swHandlers.fetch({request:{url:scope+resource,method:'GET',mode:resource==='index.html'?'navigate':'cors'},respondWith:p=>response=p});assert.ok((await (await response).arrayBuffer()).byteLength>0,resource);
}
let response;swHandlers.fetch({request:{url:scope+'?from=installed',method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.ok((await (await response).text()).includes('id="app"'));
swHandlers.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(skip,1);
const manifest=JSON.parse(await fs.readFile(path.join(root,'site/manifest.webmanifest'),'utf8'));assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
console.log('PWA: offline cache covers HTML, modules, PDF library, logo and icons; subdirectory routing and isolated cache updates passed.');
console.log('No visual browser or real installation test was performed in this environment.');
