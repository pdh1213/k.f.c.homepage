import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {transformWithEsbuild} from 'vite';
const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../components/ui/particle-title.tsx',import.meta.url),'utf8');
const compiled=(await transformWithEsbuild(source,'particle-title.tsx',{loader:'tsx',format:'cjs',jsx:'automatic'})).code;
function fixture(){
  let now=0,id=0,completed=0,draws=0;
  const timers=new Map(),frames=new Map();
  const context={
    setTransform(){},clearRect(){},fillText(){},beginPath(){},arc(){},fill(){},
    measureText(){return {width:140,actualBoundingBoxRight:70,actualBoundingBoxLeft:70};},
    getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4).fill(255)};},
    drawImage(){draws++;}
  };
  const canvas={clientWidth:200,clientHeight:100,width:0,height:0,getContext:()=>context};
  const module={exports:{}};
  const sandbox={
    module,exports:module.exports,require:id=>id.endsWith('.css')?{}:require(id),
    window:{devicePixelRatio:1,setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;}},
    document:{createElement:()=>({width:0,height:0,getContext:()=>context})},
    performance:{now:()=>now},
    clearTimeout:key=>timers.delete(key),
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},
    cancelAnimationFrame:key=>frames.delete(key)
  };
  vm.runInNewContext(compiled+'\nmodule.exports.testEngine=createEngine;module.exports.testPalette=LIGHT;',sandbox);
  const engine=module.exports.testEngine(canvas,'What will you create today?',module.exports.testPalette,()=>completed++);
  return {engine,timers,frames,get completed(){return completed;},get draws(){return draws;},
    hold(){const entry=[...timers.entries()][0];assert.ok(entry);timers.delete(entry[0]);now+=entry[1].delay;entry[1].fn();},
    frame(ms){now+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));}
  };
}
test('문구를 먼저 보여주고 한 번 흩어진 뒤 종료한다',()=>{
  const f=fixture();assert.ok(f.draws>0);assert.equal([...f.timers.values()][0].delay,1800);
  f.hold();for(let i=0;i<12;i++)f.frame(200);
  assert.equal(f.completed,1);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
});
test('화면 해제 시 타이머와 프레임을 정리한다',()=>{
  const f=fixture();f.engine.destroy();
  assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);f.frame(5000);assert.equal(f.completed,0);
});
test('백그라운드에서는 입자 작업을 멈춘다',()=>{
  const f=fixture();f.engine.setActive(false);
  assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);
  f.engine.setActive(true);assert.equal(f.timers.size,1);f.engine.destroy();
});
