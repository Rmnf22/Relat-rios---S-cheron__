import {codeFor,displayDate} from './model.js';

// The same pagination engine serves the preview, download and Node verification.
export async function generatePdf(report,logoBytes){
 const {PDFDocument,StandardFonts,rgb}=globalThis.PDFLib;
 const pdf=await PDFDocument.create();
 const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),symbol=await pdf.embedFont(StandardFonts.Symbol);
 const logo=await pdf.embedJpg(logoBytes);
 const W=595.28,H=841.89,L=56.7,R=545.7,CW=R-L,TOP=87,BOTTOM=780;
 const black=rgb(.12,.14,.13),gray=rgb(.42,.46,.43),green=rgb(0,.61,.40),line=rgb(.76,.78,.77),pale=rgb(.94,.95,.94);
 let page,y=TOP;const diagnostics=[];
 const norm=t=>String(t??'').normalize('NFC').replace(/\t/g,'    ').replace(/[\u00a0\u202f]/g,' ').replace(/\r/g,'').replace(/\u200b/g,'').replace(/Ω/g,'Ω').replace(/Δ/g,'∆');
 const glyph=(c,b=false)=>{const f=b?bold:regular;try{f.encodeText(c);return f;}catch{try{symbol.encodeText(c);return symbol;}catch{throw new Error(`O caractere “${c}” não é compatível com a fonte do PDF. Substitua-o por texto equivalente.`);}}};
 function width(t,size=10,b=false){let w=0;for(const c of norm(t))if(c!=='\n')w+=glyph(c,b).widthOfTextAtSize(c,size);return w;}
 function draw(t,x,top,size=10,b=false,color=black){
  t=norm(t);let current='',font=null;
  const flush=()=>{if(current){page.drawText(current,{x,y:H-top-size,font,size,color});x+=font.widthOfTextAtSize(current,size);current='';}};
  for(const c of t){if(c==='\n')continue;const f=glyph(c,b);if(f!==font){flush();font=f;}current+=c;}flush();
 }
 function wrap(text,max,size=10,b=false){
  const result=[];
  for(const para of norm(text).split('\n')){
   if(!para.trim()){result.push('');continue;}
   let lineText='';
   for(const word of para.trim().split(/\s+/)){
    const candidate=lineText?lineText+' '+word:word;
    if(width(candidate,size,b)<=max){lineText=candidate;continue;}
    if(lineText){result.push(lineText);lineText='';}
    if(width(word,size,b)<=max){lineText=word;continue;}
    for(const c of word){if(lineText&&width(lineText+c,size,b)>max){result.push(lineText);lineText='';}lineText+=c;}
   }
   if(lineText)result.push(lineText);
  }
  return result.length?result:[''];
 }
 function rect(x,top,w,h,fill,border=line){page.drawRectangle({x,y:H-top-h,width:w,height:h,color:fill,borderColor:border,borderWidth:.5});}
 function rule(top,x=L,w=CW,color=line,thickness=.5){page.drawLine({start:{x,y:H-top},end:{x:x+w,y:H-top},color,thickness});}
 function newPage(type='body'){
  page=pdf.addPage([W,H]);y=TOP;
  const lw=130,lh=lw*logo.height/logo.width;
  page.drawImage(logo,{x:(W-lw)/2,y:H-32-lh,width:lw,height:lh});
  rule(79,39,W-78,gray,.65);
  diagnostics.push({page:pdf.getPageCount(),type,elements:[]});
  return page;
 }
 function mark(kind,top,height){diagnostics.at(-1).elements.push({kind,top,height,bottom:top+height});}
 function ensure(h){if(y+h>BOTTOM)newPage();}
 function paragraph(text,{size=10,indent=0,style='paragraph'}={}){
  if(!String(text||'').trim())return;
  const lh=size*1.42;
  const paragraphs=norm(text).split('\n');let num=0;
  for(const p of paragraphs){
   if(!p.trim()){ensure(lh);y+=lh;continue;}
   const prefix=style==='bullet'?'• ':style==='numbered'?`${++num}. `:'';
   const inset=prefix?14:0;
   const lines=wrap(p,CW-indent-inset,size);
   ensure(Math.min(lines.length,2)*lh+4);
   for(let i=0;i<lines.length;i++){
    ensure(lh+2);if(i===0&&prefix)draw(prefix,L+indent,y,size);
    draw(lines[i],L+indent+inset,y,size);mark('text',y,lh);y+=lh;
   }
   y+=style==='paragraph'?7:4;
  }
  y+=4;
 }
 function heading(text,reserve=45){
  const lines=wrap(text.toUpperCase(),CW,11,true);ensure(lines.length*15+Math.max(45,reserve)+16);y+=4;
  for(const s of lines){draw(s,L,y,11,true);mark('heading',y,15);y+=15;}
  y+=12;
 }
 function table(headers,rows,{weights=null,size=8.2}={}){
  if(!headers.length)return;
  if(!weights){weights=headers.map((h,i)=>/^(item|n[º°o]?|quantidade|qtd|avaliação)$/i.test(h.trim())?.65:/descri|pontos|critério|esperado|obtido/i.test(h)?1.8:1.15);}
  const total=weights.reduce((a,b)=>a+b,0);const widths=weights.map(w=>CW*w/total),lh=size*1.35,pad=6;
  const headerLines=headers.map((h,i)=>wrap(h,widths[i]-2*pad,size,true));
  const hh=Math.max(...headerLines.map(x=>x.length))*lh+pad*2;
  if(hh>250)throw new Error('O cabeçalho de uma tabela está muito longo. Reduza os títulos das colunas.');
  function paint(lines,height,isHead){let x=L;
   for(let c=0;c<headers.length;c++){
    rect(x,y,widths[c],height,isHead?pale:rgb(1,1,1));
    lines[c].forEach((s,k)=>draw(s,x+pad,y+pad+k*lh,size,isHead));x+=widths[c];
   }
   mark(isHead?'table-header':'table-row',y,height);y+=height;
  }
  function header(){paint(headerLines,hh,true);}
  ensure(hh+lh+pad*2);header();
  for(const row of rows){
   const lines=headers.map((_,c)=>wrap(row[c]??'',widths[c]-2*pad,size));
   let remaining=Math.max(...lines.map(x=>x.length)),offset=0;
   if(remaining*lh+pad*2<=BOTTOM-TOP-hh&&y+remaining*lh+pad*2>BOTTOM){newPage();header();}
   while(remaining>0){
    let fit=Math.floor((BOTTOM-y-2*pad)/lh);
    if(fit<1){newPage();header();fit=Math.floor((BOTTOM-y-2*pad)/lh);}
    const take=Math.min(remaining,fit);paint(lines.map(ls=>ls.slice(offset,offset+take)),take*lh+2*pad,false);
    remaining-=take;offset+=take;if(remaining){newPage();header();}
   }
  }
  y+=17;
 }
 const imageCache=new Map();
 async function embedPhoto(src){if(!imageCache.has(src))imageCache.set(src,src.startsWith('data:image/png')?await pdf.embedPng(src):await pdf.embedJpg(src));return imageCache.get(src);}
 async function firstPhotoHeight(block){const cols=block.columns===1?1:2,cell=(CW-16*(cols-1))/cols;let ih=0,ch=0;for(const p of block.photos.slice(0,cols)){const img=await embedPhoto(p.src),scale=Math.min(cell/img.width,(cols===1?350:238)/img.height);ih=Math.max(ih,img.height*scale);ch=Math.max(ch,p.caption.trim()?wrap(p.caption,cell,9).length*12.5:0);}return ih+(ch?9+ch:0)+20;}
 async function photos(block){
  const columns=block.columns===1?1:2,gap=16,cell=(CW-gap*(columns-1))/columns;
  for(let i=0;i<block.photos.length;i+=columns){
   const group=block.photos.slice(i,i+columns),items=[];
   for(const p of group){
    const img=await embedPhoto(p.src);
    const maxH=columns===1?350:238,scale=Math.min(cell/img.width,maxH/img.height);
    const cap=String(p.caption||'').trim()?wrap(p.caption,cell,9):[];
    if(cap.length>35)throw new Error('Uma legenda está muito longa. Coloque a descrição detalhada em um bloco de texto.');
    items.push({img,w:img.width*scale,h:img.height*scale,cap});
   }
   const ih=Math.max(...items.map(a=>a.h)),ch=Math.max(...items.map(a=>a.cap.length))*12.5;
   const height=ih+(ch?9+ch:0)+20;ensure(height);
   items.forEach((a,c)=>{const x=L+c*(cell+gap);page.drawImage(a.img,{x:x+(cell-a.w)/2,y:H-y-a.h,width:a.w,height:a.h});a.cap.forEach((t,k)=>draw(t,x,y+ih+9+k*12.5,9));});
   mark('photos',y,height);y+=height;
  }
 }
 const m=report.meta;
 newPage('cover');
 const id=codeFor(report),idLines=wrap(id,218,10);
 const idH=Math.max(28,idLines.length*14+12);
 rect(L,91,CW,idH,rgb(1,1,1));draw('RELATÓRIO TÉCNICO N°',L+7,99,9,true);idLines.forEach((s,k)=>draw(s,L+148,99+k*14,10));
 draw('DATA',L+367,99,9,true);draw(displayDate(m.date),L+407,99,9);
 y=91+idH+27;
 for(const [label,value] of [['CLIENTE',m.client],['PROJETO',m.project],['STATUS',m.status],['LOCALIDADE',m.location]]){
  const ls=wrap(value||'—',CW-94,10);const h=Math.max(23,ls.length*14+10);
  ensure(h+10);rect(L,y,CW,h,rgb(1,1,1));draw(label,L+6,y+6,9,true);ls.forEach((s,k)=>draw(s,L+89,y+5+k*14,10));mark('cover-field',y,h);y+=h+10;
 }
 if(report.settings.equipmentOn){
  heading('Dados do equipamento');
  for(const [label,value] of [['DESCRIÇÃO',m.equipment],['CÓDIGO',m.equipmentCode],['S/N',m.serial],['QUANTIDADE',m.quantity]]){
   const ls=wrap(value||'—',CW-94,9.5);const h=Math.max(21,ls.length*13+8);rect(L,y,CW,h,rgb(1,1,1));draw(label,L+6,y+5,9,true);ls.forEach((s,k)=>draw(s,L+89,y+4+k*13,9.5));y+=h+6;
  }
 }
 y+=9;heading('Solicitação de serviço');paragraph(m.request);
 heading('Escopo');paragraph(m.scope);
 // Long cover content flows into continuation pages rather than overlapping signatures.
 if(y>617)newPage('cover-continuation');
 y=Math.max(y+8,644);
 const signatureTop=y;rect(L-10,signatureTop-14,CW+20,110,rgb(.90,.91,.90),rgb(.90,.91,.90));
 const widths=[111,156,39,64,CW-370];
 const sigRows=[['Elaborado por',m.author,'Data',displayDate(m.authorDate),'Assinatura'],['Verificado e\naprovado por',m.reviewer,'Data',displayDate(m.reviewDate),'Assinatura']];
 for(const row of sigRows){let x=L;const cellLines=row.map((v,i)=>wrap(v,widths[i]-10,8.5,i===0||i===2));const rh=Math.max(38,...cellLines.map(v=>v.length*11+12));
  if(y+rh>756)throw new Error('Os nomes dos responsáveis estão muito longos para a área de assinatura.');
  cellLines.forEach((ls,i)=>{rect(x,y,widths[i],rh,rgb(1,1,1));ls.forEach((s,k)=>draw(s,x+5,y+7+k*11,8.5,i===0||i===2));x+=widths[i];});mark('signatures',y,rh);y+=rh;
 }
 rule(767,L,CW,green,1.8);
 ['SECHERON HASLER DO BRASIL','CNPJ: 21.753.243/0001-70','https://www.secheron.com'].forEach((s,i)=>draw(s,L+3,779+i*10,7.8));
 ['Rua João Anes, 90 – Alto da Lapa','São Paulo – SP – CEP: 05060-020','Tel. +55 11 3714 6026'].forEach((s,i)=>draw(s,R-width(s,7.8),779+i*10,7.8));
 if(report.settings.revisionOn){newPage('revisions');y+=15;heading('Alterações de revisão');table(['REVISÃO','DATA','ELABORADO POR','DESCRIÇÃO'],report.revisions.map(v=>[v.revision,displayDate(v.date),v.author,v.description]),{weights:[.65,1,1.9,2.2],size:9});}
 if(report.sections.length)newPage('body');
 for(let index=0;index<report.sections.length;index++){
  const s=report.sections[index];if(s.breakBefore&&y>TOP+5)newPage();
  const first=s.blocks.find(b=>b.type==='text'?b.text.trim():b.type==='photos'?b.photos.length:true);
  const reserve=first?.type==='photos'?await firstPhotoHeight(first):45;
  heading((report.settings.numberSections?`${index+1}. `:'')+(s.title||'Tópico sem título'),reserve);
  for(const b of s.blocks){if(b.type==='text')paragraph(b.text,{style:b.style});if(b.type==='table')table(b.headers,b.rows);if(b.type==='photos')await photos(b);}
  y+=8;
 }
 const pages=pdf.getPages();
 for(let i=0;i<pages.length;i++){
  page=pages[i];if(i>0)draw(`${i+1} / ${pages.length}`,R-width(`${i+1} / ${pages.length}`,8),817,8,false,gray);
  if(report.settings.draft)draw('RASCUNHO',39,816,8,true,gray);
 }
 pdf.setTitle(`Relatório técnico ${codeFor(report)}`);pdf.setAuthor(m.author||'');pdf.setSubject(m.scope.slice(0,1000));pdf.setCreator('Sécheron · Gerador de relatórios');
 return {bytes:await pdf.save(),pageCount:pages.length,diagnostics};
}
