export const uid = () => globalThis.crypto?.randomUUID?.() || 'id-' + Math.random().toString(36).slice(2) + Date.now();
export const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const clone = x => JSON.parse(JSON.stringify(x));
export function textBlock(text='',style='paragraph'){return {id:uid(),type:'text',text,style};}
export function tableBlock(headers=['Item','Descrição','Resultado'],rows=[['','','']]){return {id:uid(),type:'table',headers,rows};}
export function photoBlock(){return {id:uid(),type:'photos',columns:2,photos:[]};}
export const presets = [
 {key:'free',title:'Tópico livre',description:'Seu título, textos, fotos e tabelas.'},
 {key:'inspection',title:'Inspeção visual',description:'Constatações e evidências fotográficas.'},
 {key:'isolation',title:'Ensaios de isolação',description:'Pontos de medição, valores e referência.'},
 {key:'functional',title:'Testes funcionais',description:'Verificações e resultados obtidos.'},
 {key:'events',title:'Análise de eventos do SEPCOS',description:'Registros, configurações e diagnóstico.'},
 {key:'parts',title:'Lista de peças de reposição',description:'Descrição, código e quantidade.'},
 {key:'tools',title:'Instrumentos utilizados',description:'Rastreabilidade e calibração.'},
 {key:'conclusion',title:'Conclusão',description:'Resultado do serviço e pendências.'},
 {key:'recommendations',title:'Recomendações ao cliente',description:'Ações e orientações para o cliente.'}
];
export function newSection(key='free'){
 const preset=presets.find(x=>x.key===key)||presets[0];
 const s={id:uid(),title:key==='free'?'Novo tópico':preset.title,breakBefore:false,blocks:[textBlock()]};
 if(key==='inspection')s.blocks.push(photoBlock());
 if(key==='isolation')s.blocks.push(tableBlock(['Pontos ensaiados','Tensão aplicada','Duração','Valor medido','Critério / referência','Avaliação'],[['','','','','','']]));
 if(key==='functional')s.blocks.push(tableBlock(['Verificação','Resultado esperado','Resultado obtido','Avaliação'],[['','','','']]));
 if(key==='parts')s.blocks=[tableBlock(['Item','Descrição','Código','Quantidade'],[['1','','','']])];
 if(key==='tools')s.blocks=[tableBlock(['Instrumento','S/N','TAG','Certificado','Validade'],[['','','','','']])];
 if(key==='recommendations')s.blocks[0].style='bullet';
 return s;
}
export function newReport(kind='field'){
 const date=today();
 return {version:1,id:uid(),numbering:{mode:'automatic',status:'draft',requestId:uid()},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
 meta:{kind,number:'',revision:'00',date,bu:'TPS',client:'',project:'',country:'Brasil',location:kind==='center'?'Laboratório - Sécheron Hasler do Brasil':'',status:'',request:'',scope:'',author:'',authorDate:date,reviewer:'',reviewDate:'',equipment:'',equipmentCode:'',serial:'',quantity:'1',filename:'',sheet:''},
 settings:{equipmentOn:kind==='center',revisionOn:true,numberSections:true,draft:true},
 revisions:[{revision:'00',date,author:'',description:'Primeira edição'}],
 sections:[{...newSection(),title:'Descrição dos serviços realizados'},newSection('conclusion')]};
}
export function codeFor(r){const b=(r.meta.number||'SEM-NÚMERO').trim().replace(/^RT\s*/i,'').replace(/\.\d{2}$/,'');return b+'.'+String(r.meta.revision||'00').padStart(2,'0');}
export function filenameFor(r){const m=r.meta;const n=m.filename.trim()||(m.project.trim()?`RT${codeFor(r)} - ${m.bu}_SEBR - ${m.project} - ${m.client}`:`RT${codeFor(r)} - ${m.bu} - SEBR - ${m.client}`);return n.replace(/\.(pdf|json)$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,190);}
export function displayDate(s){if(/^\d{4}-\d{2}-\d{2}$/.test(s||''))return s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4);return s||'';}
export function missingFields(r){const issues=[['number','Número do relatório'],['bu','Unidade de negócio'],['client','Cliente'],['location','Localidade'],['date','Data do relatório'],['scope','Escopo'],['author','Elaborado por']].filter(([k])=>!r.meta[k]?.trim()).map(x=>x[1]);
 if(r.meta.number){const match=codeFor(r).match(/^\d{3,6}([FL])(0[1-9]|1[0-2])\d{2}\.\d{2}$/);if(!match)issues.push('Número completo no padrão NNNF/LMMYY.RR');else if(match[1]!== (r.meta.kind==='center'?'L':'F'))issues.push('Número correspondente à área selecionada');}
 return issues;}
export function numberFromParts(sequence,kind,month,year,revision='00'){
 if(!/^\d{1,6}$/.test(String(sequence))||Number(sequence)<1||!/^\d{1,2}$/.test(String(month))||Number(month)<1||Number(month)>12||!/^\d{2}$/.test(String(year))||!/^\d{1,2}$/.test(String(revision)))throw new Error('Informe uma sequência positiva, mês de 01 a 12, ano com dois dígitos e revisão de 00 a 99.');
 return String(sequence).padStart(3,'0')+(kind==='center'?'L':'F')+String(month).padStart(2,'0')+year+'.'+String(revision).padStart(2,'0');
}
export function applyRecord(r,record){
 const kind=record.sheet==='ServiceCenter'?'center':'field';
 r.meta.kind=kind;r.meta.number=String(record.number||'').replace(/^RT\s*/,'').replace(/\.\d{2}$/,'');r.meta.revision=String(record.revision??'00').padStart(2,'0');
 for(const k of ['bu','client','project','author','country'])r.meta[k]=record[k]!=null?String(record[k]):'';
 r.meta.location=record.location|| (kind==='center'?'Laboratório - Sécheron Hasler do Brasil':'');
 r.meta.filename='';r.meta.sheet=record.sheet+' · linha '+record.row;r.settings.equipmentOn=kind==='center';
 if(r.revisions.length===1){r.revisions[0].revision=r.meta.revision;r.revisions[0].author=r.meta.author;}
}
export function validateReport(raw){
 if(!raw || raw.version!==1 || !raw.meta || !Array.isArray(raw.sections))throw new Error('Selecione um arquivo JSON exportado por este gerador.');
 if(raw.sections.length>200)throw new Error('O arquivo ultrapassa 200 tópicos.');
 const r=newReport();
 for(const k of Object.keys(r.meta))if(typeof raw.meta[k]==='string')r.meta[k]=raw.meta[k].slice(0,100000);
 if(!['field','center'].includes(r.meta.kind))r.meta.kind='field';
 for(const k of Object.keys(r.settings))if(typeof raw.settings?.[k]==='boolean')r.settings[k]=raw.settings[k];
 const n=raw.numbering;
 if(n){
  if(!['automatic','existing'].includes(n.mode)||!['draft','pending','registered'].includes(n.status)||!/^[a-zA-Z0-9-]{8,100}$/.test(n.requestId||''))throw new Error('Dados de numeração inválidos no editável.');
  r.numbering={mode:n.mode,status:n.status,requestId:String(n.requestId)};
  if(n.status!=='draft'){
   if(n.attempt?.requestId!==n.requestId||!n.attempt.metadata)throw new Error('A solicitação de registro está incompleta.');
   const keys=['kind','revision','date','bu','client','project','author','location','country'];
   r.numbering.attempt={version:1,requestId:n.requestId,metadata:Object.fromEntries(keys.map(k=>[k,String(n.attempt.metadata[k]??'').slice(0,1000)])),pdfValidated:true};
   if(n.status==='registered'){
    if(n.receipt?.requestId!==n.requestId||!/^\d{3,6}[FL](0[1-9]|1[0-2])\d{2}$/.test(n.receipt.number||''))throw new Error('O comprovante de registro está incompleto.');
    r.numbering.receipt={requestId:n.requestId,status:'registered',number:n.receipt.number,revision:String(n.receipt.revision),sheet:String(n.receipt.sheet),row:Number(n.receipt.row)||0,registeredAt:String(n.receipt.registeredAt||'')};
   }
  }
 }else r.numbering={mode:r.meta.number?'existing':'automatic',status:'draft',requestId:uid()};
 r.revisions=(Array.isArray(raw.revisions)?raw.revisions:[]).slice(0,100).map(v=>Object.fromEntries(['revision','date','author','description'].map(k=>[k,String(v[k]??'').slice(0,10000)])));
 r.sections=raw.sections.map(s=>({id:uid(),title:String(s.title??'').slice(0,1000),breakBefore:!!s.breakBefore,blocks:(Array.isArray(s.blocks)?s.blocks:[]).slice(0,200).map(b=>{
  if(b.type==='text')return {...textBlock(String(b.text??'').slice(0,200000)),style:['paragraph','bullet','numbered'].includes(b.style)?b.style:'paragraph'};
  if(b.type==='table'){
   const h=(Array.isArray(b.headers)?b.headers:[]).slice(0,10).map(v=>String(v).slice(0,1000));
   if(!h.length)throw new Error('Uma tabela do arquivo não tem colunas.');
   const rows=(Array.isArray(b.rows)?b.rows:[]).slice(0,2000).map(row=>h.map((_,i)=>String(row?.[i]??'').slice(0,20000)));
   return tableBlock(h,rows);
  }
  if(b.type==='photos')return {id:uid(),type:'photos',columns:b.columns===1?1:2,photos:(Array.isArray(b.photos)?b.photos:[]).slice(0,100).map(p=>{
   if(!/^data:image\/(jpeg|png);base64,[a-zA-Z0-9+/=]+$/.test(p.src||'')||p.src.length>12000000)throw new Error('Imagem inválida no arquivo. Use PNG ou JPEG.');
   return {id:uid(),src:p.src,caption:String(p.caption??'').slice(0,5000),name:String(p.name??'').slice(0,200)};
  })};
  throw new Error('Tipo de bloco desconhecido no arquivo.');
 })}));
 return r;
}
export function parseDelimited(text){
 text=text.replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/)[0]||'';
 const sep=first.includes('\t')?'\t':((first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',');
 let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===sep&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 if(quoted)throw new Error('Há aspas sem fechamento na tabela.');
 return rows;
}
export function moveItem(array,index,delta){const to=index+delta;if(index<0||to<0||to>=array.length)return false;[array[index],array[to]]=[array[to],array[index]];return true;}
