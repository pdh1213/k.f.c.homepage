import test from 'node:test';
import assert from 'node:assert/strict';
import {BlobWriter,TextReader,ZipWriter} from '@zip.js/zip.js';
import {readStudioModel} from '../src/studio-model.js';

test('암호화된 Studio .io에서 3D 모델을 추출한다',async()=>{
  const writer=new ZipWriter(new BlobWriter(),{password:'soho0909',zipCrypto:true});
  const model='0 FILE robot.io\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 brick.dat\n0 FILE brick.dat\n3 16 0 0 0 20 0 0 0 20 0\n';
  await writer.add('model2.ldr',new TextReader(model));
  const blob=await writer.close();
  const file=new File([blob],'robot.io');
  assert.equal(await readStudioModel(file),model);
  await assert.rejects(readStudioModel(new File([blob],'robot.zip')),/\.io 파일/);
});

