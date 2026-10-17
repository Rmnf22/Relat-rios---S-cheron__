export const logoSource=globalThis.SECHERON_PORTABLE_ASSETS?.logo||'assets/secheron.jpg';
export async function loadLogo(){
 if(globalThis.SECHERON_PORTABLE_ASSETS){const b64=globalThis.SECHERON_PORTABLE_ASSETS.logo.split(',')[1];return Uint8Array.from(atob(b64),c=>c.charCodeAt(0));}
 const response=await fetch('assets/secheron.jpg');if(!response.ok)throw new Error('Não foi possível carregar o cabeçalho.');return new Uint8Array(await response.arrayBuffer());
}
export async function defaultCatalog(){return {source:'Nenhuma planilha importada',date:'',records:[]};}
