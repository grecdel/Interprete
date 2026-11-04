'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('interpreteDesktop', {
  request: (path, data) => ipcRenderer.invoke('interprete:request', {path, data}),
  transcribe: (audio, mimeType) => ipcRenderer.invoke('interprete:audio', {audio: new Uint8Array(audio), mimeType}),
  settings: () => ipcRenderer.invoke('interprete:settings'),
  saveKey: (key, remember) => ipcRenderer.invoke('interprete:key', {key, remember}),
  setPanelOpen: open => ipcRenderer.send('interprete:panel', Boolean(open)),
  setUnsaved: value => ipcRenderer.send('interprete:unsaved', Boolean(value)),
  saveArchive: (content, extension, name) => ipcRenderer.invoke('interprete:archive', {content, extension, name}),
  copyText: text => ipcRenderer.invoke('interprete:copy', text),
  quit: () => ipcRenderer.send('interprete:quit'),
  onOpen: callback => { ipcRenderer.on('interprete:open', () => callback()); },
});
