let installPrompt=null,registration=null,offlineReady=false,offlineError=false,installDone=false,waitingForUpdate=false;
const portable=!!globalThis.SECHERON_PORTABLE_ASSETS || globalThis.location?.protocol==='file:';
export function distributionLabel(){
 if(portable)return 'Arquivo portátil · uso offline';
 if(waitingForUpdate)return 'Atualização disponível';
 if(offlineReady)return navigator.onLine?'Pronto para uso offline':'Offline · pronto para usar';
 if(offlineError)return 'Modo offline não preparado';
 return 'Preparando uso offline…';
}
export function refreshDistribution(){
 document.querySelectorAll('[data-distribution]').forEach(e=>e.textContent=distributionLabel());
 document.querySelectorAll('[data-action="install-app"]').forEach(e=>{e.hidden=portable||installDone||globalThis.matchMedia?.('(display-mode: standalone)').matches;});
 document.querySelectorAll('[data-action="update-app"]').forEach(e=>e.hidden=!waitingForUpdate);
}
export async function setupOffline(){
 refreshDistribution();if(portable)return;
 window.addEventListener('online',refreshDistribution);window.addEventListener('offline',refreshDistribution);
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;refreshDistribution();});
 window.addEventListener('appinstalled',()=>{installDone=true;installPrompt=null;refreshDistribution();});
 if(!('serviceWorker' in navigator)||!globalThis.isSecureContext){offlineError=true;refreshDistribution();return;}
 try{
  registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  const hasUpdate=()=>{waitingForUpdate=!!registration.waiting;refreshDistribution();};hasUpdate();
  registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){hasUpdate();if(!navigator.serviceWorker.controller){offlineReady=true;refreshDistribution();}}});});
  await navigator.serviceWorker.ready;offlineReady=true;refreshDistribution();
 }catch{offlineError=true;refreshDistribution();}
}
export async function installApp(){
 if(portable)return {message:'Esta versão já abre diretamente do seu computador, sem instalação e sem internet. Mantenha o arquivo HTML e baixe o editável para guardar cada relatório.'};
 if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();const result=await prompt.userChoice;return {message:result.outcome==='accepted'?'Instalação solicitada. Aguarde a indicação “Pronto para uso offline” antes de sair da internet.':'Você pode instalar mais tarde pelo menu do navegador.'};}
 return {message:'Abra este endereço HTTPS no Chrome ou Edge e procure o ícone de instalação na barra de endereço ou a opção de instalar aplicativo no menu. Espere aparecer “Pronto para uso offline”. A instalação depende do navegador e das políticas do computador.'};
}
export function updateApp(){
 if(!registration?.waiting)return false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});return true;
}
