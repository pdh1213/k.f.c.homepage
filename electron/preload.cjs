const {contextBridge,ipcRenderer}=require('electron');
if(location.protocol==='file:'){
  contextBridge.exposeInMainWorld('kfcDesktop',{
    getServerUrl:()=>ipcRenderer.invoke('kfc:get-server-url'),
    setServerUrl:value=>ipcRenderer.invoke('kfc:set-server-url',value)
  });
}
