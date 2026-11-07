'use strict';
const {contextBridge, ipcRenderer} = require('electron');
// Electron prefixes errors thrown in the main process with "Error invoking remote method …": keep only our message.
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args).catch(error => {
  throw new Error(String(error?.message || error).replace(/^Error invoking remote method '[^']*': (?:[A-Za-z]*Error: )?/, ''));
});
contextBridge.exposeInMainWorld('interpreteDesktop', {
  request: (path, data) => invoke('interprete:request', {path, data}),
  transcribe: (audio, mimeType) => invoke('interprete:audio', {audio: new Uint8Array(audio), mimeType}),
  settings: () => invoke('interprete:settings'),
  setLauncherOpen: open => ipcRenderer.send('interprete:launcher',Boolean(open)),
  setTheme: theme => invoke('interprete:theme',theme),
  completeOnboarding: theme => invoke('interprete:onboard',theme),
  saveKey: (key, remember) => invoke('interprete:key', {key, remember}),
  setPanelOpen: open => ipcRenderer.send('interprete:panel', Boolean(open)),
  setUnsaved: value => ipcRenderer.send('interprete:unsaved', Boolean(value)),
  saveArchive: (content, extension, name) => invoke('interprete:archive', {content, extension, name}),
  copyText: text => invoke('interprete:copy', text),
  quit: () => ipcRenderer.send('interprete:quit'),
  onOpen: callback => { ipcRenderer.on('interprete:open', () => callback()); },
  onService: callback => { ipcRenderer.on('interprete:service', (_event, state) => callback(String(state))); },
});
