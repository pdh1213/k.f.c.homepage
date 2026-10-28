const {contextBridge,ipcRenderer}=require('electron');
const desktop={isDesktop:true,autoUpdate:true,getAppVersion:()=>ipcRenderer.invoke('kfc:app-version')};
if(location.protocol==='file:'){
  desktop.getServerUrl=()=>ipcRenderer.invoke('kfc:get-server-url');
  desktop.setServerUrl=value=>ipcRenderer.invoke('kfc:set-server-url',value);
}
contextBridge.exposeInMainWorld('kfcDesktop',Object.freeze(desktop));
