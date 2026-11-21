import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {BlobWriter,TextReader,ZipWriter} from '@zip.js/zip.js';
import {LDrawLoader} from 'three/addons/loaders/LDrawLoader.js';
import {LDrawConditionalLineMaterial} from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import {readStudioModel} from '../src/studio-model.js';
import {resolveLDrawParts,SPIKE_SAMPLE_MODEL} from '../src/ldraw-parts.js';

test('암호화된 Studio .io에서 3D 모델을 추출한다',async()=>{
  const writer=new ZipWriter(new BlobWriter(),{password:'soho0909',zipCrypto:true});
  const model='0 FILE robot.io\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 brick.dat\n0 FILE brick.dat\n3 16 0 0 0 20 0 0 0 20 0\n';
  await writer.add('model2.ldr',new TextReader(model));
  const blob=await writer.close();
  const file=new File([blob],'robot.io');
  assert.equal(await readStudioModel(file),model);
  await assert.rejects(readStudioModel(new File([blob],'robot.zip')),/\.io 파일/);
});

test('Studio가 부품 이름을 바꿔 저장해도 허브의 색과 내부 좌표계를 복원한다',async()=>{
  const writer=new ZipWriter(new BlobWriter(),{password:'soho0909',zipCrypto:true});
  const transform='0 0 0 1 0 0 0 1 0 0 0 1';
  await writer.add('model.ldr',new TextReader('0 모델\n1 14 '+transform+' bb1142c01.dat\n'));
  await writer.add('model2.ldr',new TextReader('0 FILE 로봇.io\n1 3 '+transform+' 53444c01.dat\n0 FILE 53444c01.dat\n3 -1 0 0 0 20 0 0 0 20 0\n3 -11 0 0 1 20 0 1 0 20 1\n'));
  const file=new File([await writer.close()],'robot.io');
  const result=await readStudioModel(file);
  assert.match(result,/^1 14 .*53444c01\.dat$/m);
  assert.match(result,/^3 16 /m);
  assert.match(result,/^3 11 /m);
});

test('누락된 세부 형상 하나 때문에 상위 부품 전체가 사라지지 않는다',async()=>{
  const model='0 FILE robot.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 HUB.dat\n0 FILE hub.dat\n3 16 0 0 0 20 0 0 0 20 0\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 48\\missing.dat';
  const result=await resolveLDrawParts(model,{loadPart:async()=>null});
  assert.deepEqual(result.missing,['p/48/missing.dat']);
  assert.match(result.text,/^1 16 .*hub\.dat$/m);
  assert.match(result.text,/^3 16 /m);
  assert.doesNotMatch(result.text,/missing\.dat/);
});

test('공식 SPIKE Prime 허브·모터·센서 여섯 부품을 모두 메시로 만든다',async()=>{
  const parts=JSON.parse(gunzipSync(await readFile(new URL('../public/spike-prime-parts.bin',import.meta.url))));
  const result=await resolveLDrawParts(SPIKE_SAMPLE_MODEL,{loadPart:async name=>parts[name]||null});
  assert.deepEqual(result.missing,[]);
  const loader=new LDrawLoader().setConditionalLineMaterial(LDrawConditionalLineMaterial);
  const colors=await readFile(new URL('../public/LDConfig.ldr',import.meta.url),'utf8');
  globalThis.ProgressEvent ??= class extends Event {};
  await loader.preloadMaterials('data:text/plain,'+encodeURIComponent(colors));
  const group=await new Promise((resolve,reject)=>loader.parse(result.text,resolve,reject));
  const expected=['45601c01.dat','54675.dat','54696.dat','37308.dat','37316.dat','37312.dat'];
  for(const name of expected){
    const item=group.getObjectByName(name);
    let vertices=0;
    item?.traverse(child=>{if(child.isMesh)vertices+=child.geometry.attributes.position.count;});
    assert.ok(vertices>100,name+' 형상이 표시되지 않았습니다.');
  }
});

