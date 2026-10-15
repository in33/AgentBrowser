/**
 * AgentBrowser - 预加载脚本
 * 通过 contextBridge 安全暴露主进程能力给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('agentBrowser', {
  // 本地存储
  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),

  // 模型
  modelChat: (payload) => ipcRenderer.invoke('model:chat', payload),
  modelChatStream: (payload) => ipcRenderer.invoke('model:chat-stream', payload),
  onStreamChunk: (cb) => ipcRenderer.on('model:stream-chunk', (_e, chunk) => cb(chunk)),
  offStreamChunk: () => { ipcRenderer.removeAllListeners('model:stream-chunk'); },
  modelPresets: () => ipcRenderer.invoke('models:presets'),
  customInterfaces: () => ipcRenderer.invoke('models:customInterfaces'),
  saveCustomInterfaces: (list) => ipcRenderer.invoke('models:saveCustomInterfaces', list),
  hiddenInterfaces: () => ipcRenderer.invoke('models:hiddenInterfaces'),
  saveHiddenInterfaces: (list) => ipcRenderer.invoke('models:saveHiddenInterfaces', list),

  // 文件系统
  fsList: (rel) => ipcRenderer.invoke('fs:list', rel),
  fsRead: (rel) => ipcRenderer.invoke('fs:read', rel),
  fsWrite: (rel, content) => ipcRenderer.invoke('fs:write', rel, content),
  fsMkdir: (rel) => ipcRenderer.invoke('fs:mkdir', rel),
  fsDelete: (rel) => ipcRenderer.invoke('fs:delete', rel),
  fsRename: (oldRel, newRel) => ipcRenderer.invoke('fs:rename', oldRel, newRel),
  fsProjectsRoot: () => ipcRenderer.invoke('fs:projectsRoot'),

  // 插件
  pluginsList: () => ipcRenderer.invoke('plugins:list'),
  pluginLoad: (id) => ipcRenderer.invoke('plugins:load', id),
  pluginInstallSample: () => ipcRenderer.invoke('plugins:installSample'),

  // 系统
  sysInfo: () => ipcRenderer.invoke('sys:info'),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // 窗口控制（无边框窗口）
  winMinimize: () => ipcRenderer.invoke('win:minimize'),
  winMaximize: () => ipcRenderer.invoke('win:maximize'),
  winClose: () => ipcRenderer.invoke('win:close'),
  winIsMaximized: () => ipcRenderer.invoke('win:isMaximized'),

  // SQLite token 存储
  dbGet: (key) => ipcRenderer.invoke('db:get', key),
  dbSet: (key, value) => ipcRenderer.invoke('db:set', key, value),

  // Monad 价格
  monadPrice: () => ipcRenderer.invoke('monad:price'),
});
