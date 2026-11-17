const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  init: () => ipcRenderer.invoke('init'),
  prepare: (opts) => ipcRenderer.invoke('prepare', opts),
  play: () => ipcRenderer.invoke('play'),
  setSettings: (c) => ipcRenderer.invoke('settings:set', c),
  pickDir: () => ipcRenderer.invoke('settings:pickDir'),
  openDir: () => ipcRenderer.invoke('openDir'),
  news: () => ipcRenderer.invoke('news'),
  minimize: () => ipcRenderer.send('win:min'),
  close: () => ipcRenderer.send('win:close'),
  onProgress: (fn) => ipcRenderer.on('progress', (_e, p) => fn(p)),
  checkAccount: () => ipcRenderer.invoke('account:check'),
  switchAccount: () => ipcRenderer.invoke('account:switch'),
  logout: () => ipcRenderer.invoke('account:logout'),
  onPlay: (fn) => ipcRenderer.on('play', (_e, p) => fn(p)),
  onAccount: (fn) => ipcRenderer.on('account', (_e, c) => fn(c)),
  onClosed: (fn) => ipcRenderer.on('closed', (_e, c) => fn(c)),
  onSettings: (fn) => ipcRenderer.on('settings', (_e, s) => fn(s)),
  onStart: (fn) => ipcRenderer.on('start', () => fn()),
});
