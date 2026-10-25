import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {transformWithEsbuild} from 'vite';
import {WELCOME_MESSAGES,pickWelcomeMessage} from '../components/ui/welcome-messages.js';

const require=createRequire(import.meta.url);
const source=fs.readFileSync(new URL('../components/ui/particle-title.tsx',import.meta.url),'utf8');
const compiled=(await transformWithEsbuild(source,'particle-title.tsx',{loader:'tsx',format:'cjs',jsx:'automatic'})).code;

function fixture(title='What will you create today?',width=200,height=100){
  let now=0,id=0,completed=0,draws=0;
  const timers=new Map(),frames=new Map(),lines=[];
  const context={
    font:'500 26px sans-serif',setTransform(){},clearRect(){},
    fillText(line){lines.push(line);},beginPath(){},arc(){},fill(){},
    measureText(value){
      const size=Number.parseFloat(this.font.match(/\d+(?:\.\d+)?px/)?.[0])||26;
      const measured=value.length*size*.53;
      return {width:measured,actualBoundingBoxRight:measured/2,actualBoundingBoxLeft:measured/2};
    },
    getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4).fill(255)};},
    drawImage(){draws++;}
  };
  const canvas={clientWidth:width,clientHeight:height,width:0,height:0,getContext:()=>context};
  const module={exports:{}};
  const sandbox={
    module,exports:module.exports,require:key=>key.endsWith('.css')?{}:require(key),
    window:{devicePixelRatio:1,setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;}},
    document:{createElement:()=>({width:0,height:0,getContext:()=>context})},
    performance:{now:()=>now},
    clearTimeout:key=>timers.delete(key),
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},
    cancelAnimationFrame:key=>frames.delete(key)
  };
  vm.runInNewContext(compiled+'\nmodule.exports.testEngine=createEngine;module.exports.testPalette=LIGHT;',sandbox);
  const engine=module.exports.testEngine(canvas,title,module.exports.testPalette,()=>completed++);
  return {engine,timers,frames,lines,get completed(){return completed;},get draws(){return draws;},
    hold(){const entry=[...timers.entries()][0];assert.ok(entry);timers.delete(entry[0]);now+=entry[1].delay;entry[1].fn();},
    frame(ms){now+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));}
  };
}

test('입자가 모여 문구를 만든 뒤 유지하고 한 번 흩어져 종료한다',()=>{
  const f=fixture();
  assert.equal(f.frames.size,1);
  assert.equal(f.timers.size,0);
  assert.equal(f.completed,0);
  f.frame(1400);
  assert.ok(f.draws>0);
  assert.equal([...f.timers.values()][0].delay,1800);
  f.hold();
  assert.equal(f.frames.size,1);
  f.frame(1400);
  assert.equal(f.completed,1);
  assert.equal(f.frames.size,0);
  assert.equal(f.timers.size,0);
});

test('긴 환영 문구는 좁은 화면에서 여러 줄로 표시한다',()=>{
  const f=fixture(WELCOME_MESSAGES[49],280,240);
  assert.ok(f.lines.length>1);
  assert.ok(f.lines.every(line=>line.length>0));
  f.engine.destroy();
});

test('화면 해제 시 타이머와 프레임을 정리한다',()=>{
  const f=fixture();f.engine.destroy();
  assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);f.frame(5000);assert.equal(f.completed,0);
});

test('백그라운드에서는 입자 작업을 멈춘다',()=>{
  const f=fixture();f.engine.setActive(false);
  assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);
  f.engine.setActive(true);assert.equal(f.frames.size,1);f.engine.destroy();
});

test('제공된 50개 문구에서 각각 무작위 선택이 가능하다',()=>{
  assert.equal(WELCOME_MESSAGES.length,50);
  assert.equal(new Set(WELCOME_MESSAGES).size,50);
  assert.equal(WELCOME_MESSAGES[0],'What will you create today?');
  assert.equal(WELCOME_MESSAGES[44],'Welcome! We’ve been waiting for you.');
  assert.equal(WELCOME_MESSAGES[49],'Your extraordinary journey at K.F.C. starts now!');
  WELCOME_MESSAGES.forEach((message,index)=>{
    assert.equal(pickWelcomeMessage(()=>(index+.5)/50),message);
  });
});


test('화면 폭이 바뀌어도 입자 모임을 처음부터 다시 시작하지 않는다',()=>{
  const f=fixture();
  f.frame(600);
  f.engine.resize();
  f.frame(800);
  assert.equal([...f.timers.values()][0]?.delay,1800);
  f.hold();
  f.frame(1400);
  assert.equal(f.completed,1);
});

test('문구 유지 중 크기가 바뀌면 남은 시간만 기다린다',()=>{
  const f=fixture();
  f.frame(1400);
  f.frame(700);
  f.engine.resize();
  assert.equal([...f.timers.values()][0]?.delay,1100);
  f.hold();
  f.frame(1400);
  assert.equal(f.completed,1);
});

test('백그라운드 복귀 후에도 진행 지점을 유지한다',()=>{
  const f=fixture();
  f.frame(600);
  f.engine.setActive(false);
  f.frame(5000);
  f.engine.setActive(true);
  f.frame(800);
  assert.equal([...f.timers.values()][0]?.delay,1800);
  f.engine.destroy();
});
