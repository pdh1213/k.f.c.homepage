const {app,BrowserWindow,Menu,ipcMain,shell}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
let mainWindow;
const configPath=()=>path.join(app.getPath('userData'),'settings.json');
const savedUrl=()=>{
  try{return JSON.parse(fs.readFileSync(configPath(),'utf8')).serverUrl||'';}catch{return '';}
};
const currentUrl=()=>savedUrl()||process.env.KFC_SERVER_URL||'';
function validateUrl(value){
  try{
    const url=new URL(String(value||'').trim());
    const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local))return '';
    if(url.username||url.password||url.search||url.hash||url.pathname!=='/')return '';
    return url.origin;
  }catch{return '';}
}
function loadConfig(){
  if(!mainWindow||mainWindow.isDestroyed())return;
  mainWindow.loadFile(path.join(__dirname,'config.html'));
}
function setServerUrl(value){
  const normalized=validateUrl(value);
  if(!normalized)return {ok:false,message:'주소는 https://도메인 형식이어야 합니다. 로컬 개발은 http://localhost:4173을 사용할 수 있습니다.'};
  fs.mkdirSync(path.dirname(configPath()),{recursive:true});
  fs.writeFileSync(configPath(),JSON.stringify({serverUrl:normalized},null,2),'utf8');
  if(mainWindow&&!mainWindow.isDestroyed())mainWindow.loadURL(normalized);
  return {ok:true,serverUrl:normalized};
}
function buildMenu(){
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'K.F.C.',submenu:[
      {label:'서버 주소 설정',click:loadConfig},
      {type:'separator'},
      {role:'quit',label:'앱 종료'}
    ]},
    {label:'보기',submenu:[{role:'reload',label:'새로고침'},{role:'togglefullscreen',label:'전체 화면'}]}
  ]));
}
function createWindow(){
  mainWindow=new BrowserWindow({
    width:1280,height:850,minWidth:360,minHeight:560,show:false,
    backgroundColor:'#f5f7fb',title:'K.F.C. 로봇동아리',
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}
  });
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({url})=>{
    try{const parsed=new URL(url);if(parsed.protocol==='https:'||parsed.protocol==='http:')shell.openExternal(url);}catch{}
    return {action:'deny'};
  });
  mainWindow.webContents.on('will-navigate',(event,url)=>{
    if(url.startsWith('file:'))return;
    const active=currentUrl();
    try{if(active&&new URL(url).origin===active)return;}catch{}
    event.preventDefault();
    try{if(new URL(url).protocol==='https:')shell.openExternal(url);}catch{}
  });
  const url=validateUrl(currentUrl());
  if(url)mainWindow.loadURL(url);else loadConfig();
  mainWindow.on('closed',()=>{mainWindow=null;});
}
ipcMain.handle('kfc:get-server-url',()=>currentUrl());
ipcMain.handle('kfc:set-server-url',(_event,value)=>setServerUrl(value));
app.whenReady().then(()=>{buildMenu();createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
