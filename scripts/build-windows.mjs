import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,'..');
process.chdir(root);
if(process.env.KFC_SERVER_URL){
  const url=new URL(process.env.KFC_SERVER_URL);
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('KFC_SERVER_URL must be a HTTPS origin.');
}
const serverUrl=process.env.KFC_SERVER_URL||'https://kfc-robot-club.vercel.app';
fs.copyFileSync('public/kfc-logo.png','electron/kfc-logo.png');
fs.writeFileSync('electron/desktop-config.json',JSON.stringify({serverUrl},null,2)+'\n');
const cache=path.join(root,'work','electron-builder-cache');
fs.mkdirSync(cache,{recursive:true});
const env={...process.env,ELECTRON_BUILDER_CACHE:cache};
function run(file,args){const result=spawnSync(process.execPath,[file,...args],{cwd:root,env,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
run(path.join(path.dirname(require.resolve('vite/package.json')),'bin','vite.js'),['build']);
if(!fs.existsSync('electron/kfc-icon.ico')){
  const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/prepare-icon.ps1'],{cwd:root,stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
const runtime=path.dirname(require.resolve('electron/package.json'));
const dist=path.join(runtime,'dist');
if(!fs.existsSync(path.join(dist,'electron.exe')))throw new Error('Electron runtime missing. Run npm ci on Windows first.');
run(path.join(path.dirname(require.resolve('electron-builder/package.json')),'cli.js'),['--win','nsis','--x64','--publish','never','--config.electronDist='+dist,'--config.electronVersion='+require('electron/package.json').version]);
