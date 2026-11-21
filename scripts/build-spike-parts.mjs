import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {TextWriter,Uint8ArrayReader,ZipReader} from '@zip.js/zip.js';
import {resolveLDrawParts,SPIKE_SAMPLE_MODEL} from '../src/ldraw-parts.js';

const archivePath=process.argv[2];
if(!archivePath)throw new Error('Usage: node scripts/build-spike-parts.mjs <official LDraw complete.zip>');
const archive=new ZipReader(new Uint8ArrayReader(await readFile(archivePath)));
try{
  const entries=new Map((await archive.getEntries()).map(entry=>[entry.filename.toLowerCase().replace(/^ldraw\//,''),entry]));
  const parts={};
  const loadPart=async name=>{
    const paths=/^(parts|p)\//.test(name)?[name]:['parts/'+name,'p/'+name];
    const entry=paths.map(path=>entries.get(path)).find(Boolean);
    if(!entry||entry.directory)return null;
    const data=await entry.getData(new TextWriter());
    parts[name]=data;
    return data;
  };
  const extra=[
    '45601.dat','45601p01.dat','45601p02.dat','45610.dat',
    '54675c01.dat','54696c01.dat','37308c01.dat','37316c01.dat','37312c01.dat',
    '86652.dat','39369.dat','39370.dat','39367p01.dat','39790.dat','39793.dat','39794.dat','49283.dat','49295p01.dat',
    '48/4-4cyli.dat','48/4-4edge.dat','48/4-4ring2.dat','4-4ring4.dat','4-4con3.dat','4-4con2.dat',
    '48/1-4cylo.dat','48/1-4chrd.dat','1-16edge.dat','48/3-16edge.dat','48/3-16ndis.dat',
    '8/1-4cylo.dat','8/1-4ndis.dat','8/2-4cylo.dat','8/2-4ndis.dat','8/4-4cylo.dat','8/4-4ndis.dat',
    '8/2-4cyli.dat','8/2-8sphe.dat','8/2-4edge.dat','1-16cyli.dat','48/1-16chrd.dat'
  ];
  const model=SPIKE_SAMPLE_MODEL+'\n'+extra.map(name=>'1 16 0 0 0 1 0 0 0 1 0 0 0 1 '+name).join('\n');
  const {missing}=await resolveLDrawParts(model,{loadPart});
  const ordered=Object.fromEntries(Object.entries(parts).sort(([left],[right])=>left.localeCompare(right)));
  const packed=gzipSync(JSON.stringify(ordered),{level:9});
  await writeFile('public/spike-prime-parts.bin',packed);
  for(const name of ['careadme.txt','calicense.txt','calicense4.txt']){
    const entry=entries.get(name);
    if(entry)await writeFile('public/ldraw-'+name,await entry.getData(new TextWriter()));
  }
  console.log('LDraw files:',Object.keys(parts).length,'Compressed bytes:',packed.length,'Missing optional files:',missing.join(', ')||'none');
}finally{
  await archive.close();
}

