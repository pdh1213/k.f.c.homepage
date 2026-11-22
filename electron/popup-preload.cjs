const { contextBridge, ipcRenderer } = require("electron");

const invoke = (action, ...args) => ipcRenderer.invoke("kfc:popup-" + action, ...args);
contextBridge.exposeInMainWorld("kfcPopup", {
  state: () => invoke("read"),
  open: id => invoke("open", id),
  dismiss: id => invoke("dismiss", id),
  next: id => invoke("next", id),
  reply: (id, text) => invoke("reply", id, text),
  hold: value => invoke("hold", value),
  onState: callback => {
    ipcRenderer.on("kfc:popup-state", (_event, value) => callback(value));
  },
});
