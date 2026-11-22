const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kfcChat", {
  login: (username, password) => ipcRenderer.invoke("kfc:login", username, password),
  logout: () => ipcRenderer.invoke("kfc:logout"),
  chat: input => ipcRenderer.invoke("kfc:chat", input),
  openClub: () => ipcRenderer.invoke("kfc:club"),
  update: () => ipcRenderer.invoke("kfc:update"),
  copy: text => ipcRenderer.invoke("kfc:copy", text),
  pickFile: () => ipcRenderer.invoke("kfc:pick"),
  download: (scope, id) => ipcRenderer.invoke("kfc:download", scope, id),
  notify: (scope, name) => ipcRenderer.invoke("kfc:notify", scope, name),
  onOpenPeer: callback => {
    const listener = (_event, scope) => callback(scope);
    ipcRenderer.on("kfc:open-peer", listener);
    return () => ipcRenderer.removeListener("kfc:open-peer", listener);
  },
});
