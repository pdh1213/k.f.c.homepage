const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kfcChat", {
  login: (username, password) => ipcRenderer.invoke("kfc:login", username, password),
  logout: () => ipcRenderer.invoke("kfc:logout"),
  chat: input => ipcRenderer.invoke("kfc:chat", input),
  openClub: () => ipcRenderer.invoke("kfc:club"),
  update: () => ipcRenderer.invoke("kfc:update"),
  copy: text => ipcRenderer.invoke("kfc:copy", text),
  pickFile: () => ipcRenderer.invoke("kfc:pick"),
  download: (peer, id) => ipcRenderer.invoke("kfc:download", peer, id),
  notify: (peer, name) => ipcRenderer.invoke("kfc:notify", peer, name),
  onOpenPeer: callback => {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on("kfc:open-peer", listener);
    return () => ipcRenderer.removeListener("kfc:open-peer", listener);
  },
});
