import {splitLDraw} from './ldraw-parts.js';

export const MAX_STUDIO_FILE_BYTES=20*1024*1024;
const MAX_MODEL_BYTES=24*1024*1024;

function restorePackedColors(packed,original){
  const colors=new Map([['-1','16'],['-2','24']]);
  if(original){
    const source=splitLDraw(original),target=splitLDraw(packed);
    const references=value=>value.split(/\r?\n/).filter(line=>/^\s*1\s/.test(line)).map(line=>line.trim().split(/\s+/));
    const votes=new Map();
    for(const [name,section] of source.files){
      const other=target.files.get(name===source.root?target.root:name);
      if(!other)continue;
      const originalParts=references(section),packedParts=references(other);
      const transforms=new Map();
      for(const part of originalParts){
        const transform=part.slice(2,14).join(' ');
        const colorsAtPosition=transforms.get(transform)||new Set();
        colorsAtPosition.add(part[1]);
        transforms.set(transform,colorsAtPosition);
      }
      for(const part of packedParts){
        const known=transforms.get(part.slice(2,14).join(' '));
        if(known?.size!==1||colors.has(part[1]))continue;
        const [color]=known;
        const candidates=votes.get(part[1])||new Set();
        candidates.add(color);
        votes.set(part[1],candidates);
      }
    }
    for(const [code,candidates] of votes)if(candidates.size===1)colors.set(code,candidates.values().next().value);
  }
  return packed.replace(/^([ \t]*[1-5][ \t]+)(-?\d+)(?=\s)/gm,(_line,prefix,code)=>{
    const paletteCode=code.startsWith('-')?code.slice(1):code;
    return prefix+(colors.get(code)||colors.get(paletteCode)||paletteCode);
  });
}

export async function readStudioModel(file){
  if(!file||!/\.io$/i.test(file.name||'')||file.size<50||file.size>MAX_STUDIO_FILE_BYTES)throw Error('Studio 2.0 .io 파일을 20MB 이하로 선택해 주세요.');
  const {BlobReader,TextWriter,ZipReader}=await import('@zip.js/zip.js');
  const archive=new ZipReader(new BlobReader(file),{password:'soho0909',checkCrc32:true,strictness:'strict'});
  try{
    const entries=await archive.getEntries();
    const packed=entries.find(entry=>entry.filename==='model2.ldr');
    const original=entries.find(entry=>entry.filename==='model.ldr');
    const model=packed||original;
    if(!model||model.uncompressedSize>MAX_MODEL_BYTES)throw Error('이 .io 파일에서 미리보기용 모델을 찾을 수 없거나 모델이 너무 큽니다.');
    let text=await model.getData(new TextWriter(),{password:'soho0909'});
    if(packed){
      const source=original&&original.uncompressedSize<MAX_MODEL_BYTES?await original.getData(new TextWriter(),{password:'soho0909'}):null;
      text=restorePackedColors(text,source);
    }
    if(text.length>MAX_MODEL_BYTES||!/^0 FILE |^1 /m.test(text)||!/^1 /m.test(text))throw Error('3D 모델 데이터가 없는 .io 파일입니다.');
    if((text.match(/^0 FILE /gm)||[]).length>2500||(text.match(/^1 /gm)||[]).length>50000)throw Error('이 모델은 웹 미리보기 제한을 초과합니다.');
    for(const line of text.split(/\r?\n/)){
      if(!line.startsWith('1 '))continue;
      const part=line.trim().split(/\s+/).at(-1);
      if(!part||part.includes('..')||/^(?:[a-z]+:|\/|\\)/i.test(part))throw Error('안전하지 않은 부품 경로가 포함된 모델입니다.');
    }
    return text;
  }catch(error){
    if(error.message?.includes('.io 파일')||error.message?.includes('모델'))throw error;
    throw Error('Studio 2.0 .io 파일을 읽지 못했습니다. Studio에서 다시 저장한 파일을 선택해 주세요.');
  }finally{await archive.close()}
}

