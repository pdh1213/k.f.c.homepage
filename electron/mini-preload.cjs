const { contextBridge, ipcRenderer } = require("electron");
const invoke = (action, ...args) => ipcRenderer.invoke("kfc:mini-" + action, ...args);
contextBridge.exposeInMainWorld("miniChat", {
  state: () => invoke("state"), history: key => invoke("history", key),
  send: (key, text, id) => invoke("send", key, text, id),
  read: (key, through) => invoke("read", key, through),
  open: key => invoke("open", key), hide: () => invoke("hide"),
  onState: callback => ipcRenderer.on("kfc:mini-state", (_event, state) => callback(state)),
});
