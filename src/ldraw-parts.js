const FILE_LINE=/^\s*0\s+FILE\s+(.+?)\s*$/i;
const REFERENCE_LINE=/^\s*(1(?:\s+\S+){13})\s+(.+?)\s*$/;
const MIRROR='https://cdn.jsdelivr.net/gh/kulits/ldraw-parts@c70360d1c588be894997b2168c61909bc8058c4d/ldraw/';
const partCache=new Map();
let spikeParts;

function loadSpikeParts(){
  spikeParts ||= fetch('/spike-prime-parts.bin',{credentials:'omit',signal:AbortSignal.timeout(6000)})
    .then(async response=>{
      if(!response.ok||!response.body)return {};
      return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
    }).catch(()=>{spikeParts=null;return {}});
  return spikeParts;
}

export function ldrawName(value){
  const name=value.trim().replace(/\\/g,'/').toLowerCase();
  if(!name||name.length>180||/[\u0000-\u001f:%?#]/.test(name)||name.split('/').some(segment=>!segment||segment==='.'||segment==='..')){
    throw new Error('모델에 사용할 수 없는 부품 경로가 있습니다.');
  }
  if(name.startsWith('s/'))return 'parts/'+name;
  if(/^(8|48)\//.test(name))return 'p/'+name;
  return name;
}

export function splitLDraw(text){
  const files=new Map();
  let root=null,name=null,lines=[];
  for(const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
    const header=line.match(FILE_LINE);
    if(!header){lines.push(line);continue}
    if(name)files.set(name,lines.join('\n'));
    else if(lines.some(value=>/^\s*[1-5]\s/.test(value)))files.set('main.ldr',lines.join('\n'));
    name=ldrawName(header[1]);
    root ||= files.has('main.ldr')?'main.ldr':name;
    lines=[];
  }
  files.set(name||'main.ldr',lines.join('\n'));
  return {root:root||'main.ldr',files};
}

async function fetchPart(name,signal){
  if(partCache.has(name))return partCache.get(name);
  // Studio may refer to the hub by its internal BrickLink number.
  const alias={'bb1142c01.dat':'45601c01.dat','53444c01.dat':'45601c01.dat','55422c01.dat':'45610.dat'}[name];
  const bundled=await loadSpikeParts();
  if(signal?.aborted)throw signal.reason;
  if(bundled[name]||bundled[alias])return bundled[name]||bundled[alias];
  const candidates=(value)=>/^(parts|p)\//.test(value)?[value]:['parts/'+value,'p/'+value];
  const paths=candidates(name);
  const sources=[...paths.map(path=>'/ldraw-library/official/'+path),...paths.map(path=>'/ldraw-library/unofficial/'+path),...paths.map(path=>MIRROR+path)];
  if(alias)sources.push('/ldraw-library/official/parts/'+alias,MIRROR+'parts/'+alias);
  for(const url of sources){
    if(signal?.aborted)throw signal.reason;
    try{
      const timeout=AbortSignal.timeout(4500);
      const response=await fetch(url,{credentials:'omit',signal:signal?AbortSignal.any([signal,timeout]):timeout});
      if(!response.ok||response.headers.get('content-type')?.includes('text/html'))continue;
      const data=await response.text();
      if(!/^0\s/.test(data.trimStart())||!/^\s*[1-5]\s/m.test(data)||/^\s*0\s+FILE\s/im.test(data))continue;
      if(partCache.size>=700)partCache.delete(partCache.keys().next().value);
      partCache.set(name,data);
      return data;
    }catch(error){if(signal?.aborted)throw signal.reason}
  }
  return null;
}

export async function resolveLDrawParts(text,{signal,loadPart=fetchPart}={}){
  const {root,files}=splitLDraw(text);
  const queue=[root],visited=new Set(queue),missing=new Set(),parsed=new Map();
  let totalBytes=0;
  for(let offset=0;offset<queue.length;offset+=12){
    const batch=queue.slice(offset,offset+12);
    const results=await Promise.all(batch.map(name=>files.get(name)??(
      /^[a-z0-9][a-z0-9._/-]*\.dat$/i.test(name)?loadPart(name,signal):null
    )));
    for(let index=0;index<batch.length;index++){
      const name=batch[index],body=results[index];
      if(!body){missing.add(name);continue}
      totalBytes+=body.length;
      if(totalBytes>36*1024*1024)throw new Error('이 모델은 브라우저에서 표시할 수 있는 크기를 넘습니다.');
      const lines=body.split(/\r?\n/).map(line=>{
        const ref=line.match(REFERENCE_LINE);
        if(!ref)return {line};
        const dependency=ldrawName(ref[2]);
        if(!visited.has(dependency)){
          if(visited.size>=3500)throw new Error('이 모델은 부품 수가 너무 많아 표시할 수 없습니다.');
          visited.add(dependency);
          queue.push(dependency);
        }
        return {line:ref[1]+' '+dependency,dependency};
      });
      parsed.set(name,lines);
    }
    // The queue can grow by fewer than 12 entries on the final iteration.
    offset-=12-batch.length;
  }

  const active=new Set(),complete=new Set();
  function assemble(name,depth=0){
    if(depth>128)throw new Error('부품의 중첩 구조가 너무 깊습니다.');
    if(complete.has(name))return;
    active.add(name);
    for(const entry of parsed.get(name)||[]){
      if(!entry.dependency)continue;
      if(active.has(entry.dependency)){
        missing.add(entry.dependency);
        entry.line='';
      }else if(!parsed.has(entry.dependency))entry.line='';
      else assemble(entry.dependency,depth+1);
    }
    active.delete(name);
    complete.add(name);
  }
  assemble(root);
  return {
    text:[...parsed].map(([name,lines])=>'0 FILE '+name+'\n'+lines.map(entry=>entry.line).join('\n')).join('\n'),
    missing:[...missing]
  };
}

export const SPIKE_SAMPLE_MODEL=[
  '0 FILE spike-prime-demo.ldr',
  '1 15 -190 0 -85 1 0 0 0 1 0 0 0 1 45601c01.dat',
  '1 15 0 0 -85 1 0 0 0 1 0 0 0 1 54675.dat',
  '1 15 170 0 -85 1 0 0 0 1 0 0 0 1 54696.dat',
  '1 15 -190 0 170 1 0 0 0 1 0 0 0 1 37308.dat',
  '1 15 0 0 170 1 0 0 0 1 0 0 0 1 37316.dat',
  '1 15 170 0 170 1 0 0 0 1 0 0 0 1 37312.dat'
].join('\n');

