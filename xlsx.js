// Read the supplied numbering workbook locally; formulas are not executed.
// Cached I/J values are preferred. Missing cached names use the verified workbook rule.
import {numberFromParts} from './model.js';
export async function readNumberingXlsx(file){
 if(file.size>20*1024*1024)throw new Error('A planilha deve ter até 20 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),dv=new DataView(bytes.buffer);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){end=i;break;}}
 if(end<0)throw new Error('Não foi possível ler o arquivo. Use .xlsx sem senha.');
 const entries=dv.getUint16(end+10,true);let off=dv.getUint32(end+16,true);const files=new Map();let total=0;
 for(let i=0;i<entries;i++){
  if(off+46>bytes.length||dv.getUint32(off,true)!==0x02014b50)throw new Error('Estrutura XLSX inválida.');
  const method=dv.getUint16(off+10,true),size=dv.getUint32(off+20,true),uncompressed=dv.getUint32(off+24,true),nl=dv.getUint16(off+28,true),el=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),local=dv.getUint32(off+42,true);
  total+=uncompressed;if(total>100*1024*1024)throw new Error('O conteúdo descompactado excede 100 MB.');
  const name=new TextDecoder().decode(bytes.slice(off+46,off+46+nl));files.set(name,{method,size,local});off+=46+nl+el+cl;
 }
 async function xml(name){
  const a=files.get(name);if(!a)return null;const start=a.local+30+dv.getUint16(a.local+26,true)+dv.getUint16(a.local+28,true);let data=bytes.slice(start,start+a.size);
  if(a.method===8){if(!globalThis.DecompressionStream)throw new Error('Use uma versão atual do Chrome ou Edge para importar XLSX.');data=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());}
  else if(a.method!==0)throw new Error('Compressão XLSX não suportada.');
  const doc=new DOMParser().parseFromString(new TextDecoder().decode(data),'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('XML inválido na planilha.');return doc;
 }
 const wb=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels'),ss=await xml('xl/sharedStrings.xml');
 if(!wb||!rels)throw new Error('A estrutura do Excel não foi reconhecida.');
 const all=(node,tag)=>Array.from(node?.getElementsByTagNameNS('*',tag)||[]);
 const strings=all(ss,'si').map(n=>all(n,'t').map(t=>t.textContent).join(''));
 const relations=Object.fromEntries(all(rels,'Relationship').map(n=>[n.getAttribute('Id'),n.getAttribute('Target')]));
 const records=[];
 for(const s of all(wb,'sheet')){
  const sheet=s.getAttribute('name');if(!['FieldService','ServiceCenter'].includes(sheet))continue;
  const id=s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');let target=relations[id]||'';
  target=target.startsWith('/')?target.slice(1):'xl/'+target;const doc=await xml(target);if(!doc)continue;
  for(const row of all(doc,'row')){
   const rowIndex=Number(row.getAttribute('r'));if(rowIndex<7)continue;const cells={};
   for(const c of all(row,'c')){
    const col=(c.getAttribute('r')||'').replace(/\d/g,'');const type=c.getAttribute('t');let value=all(c,'v')[0]?.textContent??'';
    if(type==='s')value=strings[Number(value)]??'';if(type==='inlineStr')value=all(c,'t').map(t=>t.textContent).join('');cells[col]=value;
   }
   if(!cells.A||!/^\d+$/.test(cells.A))continue;
   const v=cells;let number=v.J,filename=v.I;
   if(!number){try{number=numberFromParts(v.A,sheet==='ServiceCenter'?'center':'field',v.C,v.D,v.B||'00');}catch{number='';}}
   if(!filename&&number&&v.H)filename=v.F?`RT${number} - ${v.E}_SEBR - ${v.F} - ${v.G}`:`RT${number} - ${v.E} - SEBR - ${v.G}`;
   records.push({sheet,row:rowIndex,sequence:Number(v.A),revision:v.B??'',month:v.C??'',year:v.D??'',bu:v.E??'',project:v.F??'',client:v.G??'',author:v.H??'',filename,number,location:v.K??'',country:v.L??''});
  }
 }
 if(!records.length)throw new Error('Não foram encontrados registros nas abas FieldService ou ServiceCenter.');
 return {source:file.name,date:new Date().toISOString().slice(0,10),records};
}
