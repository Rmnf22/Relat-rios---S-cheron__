import {uid,clone,numberFromParts,missingFields} from './model.js';

export const registryFields=['kind','revision','date','bu','client','project','author','location','country'];
export function registryState(r){
  if(!r.numbering)r.numbering={mode:r.meta.number?'existing':'automatic',status:'draft',requestId:uid()};
  return r.numbering;
}
export function resetNumbering(r){
  r.numbering={mode:'automatic',status:'draft',requestId:uid()};
  r.meta.number='';r.meta.filename='';r.meta.sheet='';r.meta.revision='00';r.settings.draft=true;
}
export function numberingLocked(r){return ['pending','registered'].includes(registryState(r).status);}
export function nextSequence(catalog,kind){
  if(!catalog?.ready)return null;
  const sheet=kind==='center'?'ServiceCenter':'FieldService';
  const nums=catalog.records.filter(x=>x.sheet===sheet).map(x=>Number(x.sequence));
  if(nums.some(n=>!Number.isInteger(n)||n<1||n>999999))throw new Error('A sequência da planilha contém dados inválidos.');
  const next=nums.reduce((max,n)=>Math.max(max,n),0)+1;
  if(next>999999)throw new Error('A sequência excedeu o tamanho suportado.');
  return next;
}
export function updateSuggestedNumber(r,catalog){
  const state=registryState(r);if(state.mode!=='automatic'||state.status!=='draft')return;
  const next=nextSequence(catalog,r.meta.kind);
  r.meta.number=next&&/^\d{4}-\d{2}-\d{2}$/.test(r.meta.date)?numberFromParts(next,r.meta.kind,r.meta.date.slice(5,7),r.meta.date.slice(2,4),'00').replace(/\.00$/,''):'';
  r.meta.revision='00';r.meta.filename='';r.settings.draft=true;
}
export function numberingMessage(r,catalog){
  const state=registryState(r);
  if(state.status==='registered')return 'Número registrado na planilha. Baixar novamente reutiliza este registro.';
  if(state.status==='pending')return 'Confirmação pendente. Tente gerar novamente: a mesma solicitação será consultada, sem pedir outro número.';
  if(state.mode==='existing')return 'Número de um relatório já registrado. A exportação não cria uma nova linha na planilha.';
  return r.meta.number?'Próximo número previsto — ainda não registrado. Será confirmado ao gerar o definitivo.':'Aguardando consulta à planilha para mostrar o próximo número. Nenhum número foi reservado.';
}
export function validateCatalog(data){
  if(!data||!Array.isArray(data.records)||data.records.length>100000)throw new Error('Resposta inválida do controle de numeração.');
  const records=data.records.map(x=>{
    if(!['FieldService','ServiceCenter'].includes(x.sheet)||!Number.isInteger(Number(x.sequence))||Number(x.sequence)<1||Number(x.sequence)>999999)throw new Error('Registro de numeração inválido.');
    const out={sheet:x.sheet,sequence:Number(x.sequence),row:Number(x.row)||0};
    for(const key of ['number','revision','month','year','bu','project','client','author','filename','location','country'])out[key]=String(x[key]??'').slice(0,1000);
    return out;
  });
  return {ready:true,source:String(data.source||'Excel Online').slice(0,300),date:new Date().toISOString().slice(0,10),syncedAt:new Date().toISOString(),records};
}
export class NumberingClient {
  constructor(config,{fetcher=globalThis.fetch,portable=false}={}){this.config=config;this.fetcher=fetcher;this.portable=portable;}
  get enabled(){return !this.portable&&!!this.config.apiBaseUrl;}
  async request(path,options={}){
    if(!this.enabled)throw new Error('A conexão com o Excel Online ainda não foi configurada. É necessário conectar o serviço de numeração antes de emitir novos números.');
    const base=new URL(this.config.apiBaseUrl);
    if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw new Error('A configuração deve usar uma URL HTTPS sem credenciais ou chaves.');
    base.pathname=base.pathname.replace(/\/?$/,'/');
    const response=await this.fetcher(new URL(path,base).href,{cache:'no-store',credentials:'include',redirect:'error',signal:AbortSignal.timeout(30000),...options});
    if(response.status===401||response.status===403)throw new Error('Conecte sua conta corporativa com permissão de acesso à planilha.');
    if(!response.ok)throw new Error('O controle não confirmou a operação. Tente novamente; a mesma solicitação será reutilizada.');
    return response.json();
  }
  async catalog(){return validateCatalog(await this.request('catalog'));}
  async issue(payload){return this.request('reports/issue',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':payload.requestId},body:JSON.stringify(payload)});}
}
function registrationMetadata(r){return Object.fromEntries(registryFields.map(k=>[k,String(r.meta[k]??'').trim()]));}
function validateReceipt(receipt,payload){
  const m=payload.metadata;
  if(receipt?.status!=='registered'||receipt.requestId!==payload.requestId||typeof receipt.number!=='string'||!/^\d{3,6}[FL](0[1-9]|1[0-2])\d{2}$/.test(receipt.number)||receipt.revision!==m.revision||receipt.sheet!==(m.kind==='center'?'ServiceCenter':'FieldService'))throw new Error('A resposta da planilha não confirmou a numeração. Repita a mesma solicitação.');
  const expectedTail=(m.kind==='center'?'L':'F')+m.date.slice(5,7)+m.date.slice(2,4);
  if(!receipt.number.endsWith(expectedTail))throw new Error('O número retornado não corresponde à área e data do relatório.');
  return {requestId:payload.requestId,status:'registered',number:receipt.number,revision:receipt.revision,sheet:receipt.sheet,registeredAt:String(receipt.registeredAt||''),row:Number(receipt.row)||0};
}
const activeIssues=new WeakMap();
export function generateDefinitive(r,deps){
  if(activeIssues.has(r))return activeIssues.get(r);
  const work=runDefinitive(r,deps).finally(()=>activeIssues.delete(r));activeIssues.set(r,work);return work;
}
async function runDefinitive(r,{render,save,submit,online=true,configured=false}){
  const state=registryState(r);
  if(state.status==='registered'){
    if(!state.receipt||!state.attempt)throw new Error('O comprovante de registro está incompleto.');
    Object.assign(r.meta,state.attempt.metadata,{number:state.receipt.number,filename:''});
    r.settings.draft=false;return render(clone(r));
  }
  if(state.mode==='existing'){
    const missing=missingFields(r);if(missing.length)throw new Error('Preencha antes de emitir: '+missing.join(', '));
    const copy=clone(r);copy.settings.draft=false;return render(copy);
  }
  if(!configured)throw new Error('A gravação no Excel Online ainda não está conectada. Você pode preparar e baixar o rascunho.');
  if(!online)throw new Error('Conecte-se à internet para confirmar o número e registrar na planilha. O rascunho continua disponível offline.');
  const validation=clone(r);validation.meta.number='';
  const missing=missingFields(validation).filter(x=>x!=='Número do relatório');
  if(missing.length)throw new Error('Preencha antes de emitir: '+missing.join(', '));
  if(!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(r.meta.date)||Number.isNaN(Date.parse(r.meta.date))||new Date(r.meta.date+'T12:00:00Z').toISOString().slice(0,10)!==r.meta.date)throw new Error('Informe uma data válida.');
  if(r.meta.revision!=='00')throw new Error('Um novo relatório deve começar na revisão 00.');
  if(state.attempt&&JSON.stringify(state.attempt.metadata)!==JSON.stringify(registrationMetadata(r)))throw new Error('Os dados da solicitação pendente foram alterados. Restaure os dados registrados antes de tentar novamente.');
  // Fail locally on invalid images, text or tables BEFORE any write request.
  const preflight=clone(r);preflight.settings.draft=true;await render(preflight);
  if(!state.attempt)state.attempt={version:1,requestId:state.requestId,metadata:registrationMetadata(r),pdfValidated:true};
  state.status='pending';r.updatedAt=new Date().toISOString();
  if(!await save())throw new Error('Não foi possível preservar a solicitação. Salve o editável e tente novamente.');
  const receipt=validateReceipt(await submit(clone(state.attempt)),state.attempt);
  state.receipt=receipt;state.status='registered';
  Object.assign(r.meta,state.attempt.metadata,{number:receipt.number,filename:'',sheet:receipt.sheet+(receipt.row?' · linha '+receipt.row:'')});
  r.settings.draft=false;r.updatedAt=new Date().toISOString();
  if(!await save())throw new Error('O número foi registrado, mas não foi salvo neste navegador. Baixe o editável imediatamente; não crie outro relatório para repetir a emissão.');
  // A failed download/render after confirmation keeps the receipt for reuse.
  return render(clone(r));
}
