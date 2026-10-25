import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {detectDesktop} from '../src/desktop.js';

test('신규 앱·기존 Electron 앱·일반 브라우저를 구별한다',()=>{
  assert.equal(detectDesktop({kfcDesktop:{isDesktop:true}}),true);
  assert.equal(detectDesktop({navigator:{userAgent:'Chrome/140 Electron/38.8.6 Safari/537.36'}}),true);
  assert.equal(detectDesktop({navigator:{userAgent:'Chrome/140 Safari/537.36'}}),false);
});
function fixture(){
  const updater=new EventEmitter();
  const messages=[];let checks=0,installs=0;
  updater.checkForUpdates=async()=>{checks++;updater.emit('update-not-available');return {};};
  updater.quitAndInstall=()=>installs++;
  const sandbox={module:{exports:{}},require:()=>({autoUpdater:updater}),process:{platform:'win32'},setTimeout:()=>({unref(){}}),setInterval:()=>({unref(){}}),clearTimeout(){},clearInterval(){}};
  vm.runInNewContext(fs.readFileSync(new URL('../electron/updates.cjs',import.meta.url),'utf8'),sandbox);
  const updates=sandbox.module.exports.startAutoUpdates({app:{isPackaged:true,once(){}},dialog:{showMessageBox:async(...args)=>{messages.push(args.at(-1));return {response:1};}},getWindow:()=>null});
  return {updater,updates,messages,get checks(){return checks;},get installs(){return installs;}};
}
test('자동 확인은 조용히 실행하고 수동 확인은 최신 버전을 안내한다',async()=>{
  const f=fixture();await f.updates.check();assert.equal(f.messages.length,0);
  await f.updates.check(true);assert.equal(f.checks,2);assert.equal(f.messages.length,1);
});
test('다운로드 중 중복 확인을 막고 준비된 버전만 재시작 설치한다',async()=>{
  const f=fixture();let checks=0;f.updater.checkForUpdates=async()=>{checks++;f.updater.emit('update-available');};
  await f.updates.check();await f.updates.check();assert.equal(checks,1);assert.equal(f.installs,0);
  f.updater.emit('update-downloaded');await Promise.resolve();assert.equal(f.installs,0);
  await f.updates.check(true);assert.equal(f.installs,1);
});
test('연결 오류 후 다음 확인에서 복구한다',async()=>{
  const f=fixture();f.updater.checkForUpdates=async()=>{f.updater.emit('error',new Error('offline'));throw new Error('offline');};
  await f.updates.check(true);assert.equal(f.messages.length,1);
  f.updater.checkForUpdates=async()=>f.updater.emit('update-not-available');
  await f.updates.check(true);assert.equal(f.messages.length,2);
});
