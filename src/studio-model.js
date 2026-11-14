export const MAX_STUDIO_FILE_BYTES=20*1024*1024;
const MAX_MODEL_BYTES=24*1024*1024;

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
    if(packed&&original&&original.uncompressedSize<MAX_MODEL_BYTES){
      const source=await original.getData(new TextWriter(),{password:'soho0909'});
      const sections=value=>new Map(value.split(/(?=^0 FILE )/gm).filter(Boolean).map(section=>[section.match(/^0 FILE ([^\r\n]+)/)?.[1]?.trim().toLowerCase(),section]));
      const originalSections=sections(source),packedSections=sections(text),colors=new Map([['-1','16'],['-2','24']]);
      for(const [name,left] of originalSections){const right=packedSections.get(name);if(!right)continue;const originalParts=left.split(/\r?\n/).filter(line=>line.startsWith('1 ')),packedParts=right.split(/\r?\n/).filter(line=>line.startsWith('1 '));for(let i=0;i<Math.min(originalParts.length,packedParts.length);i++){const a=originalParts[i].trim().split(/\s+/),b=packedParts[i].trim().split(/\s+/);if(a.slice(2).join(' ')===b.slice(2).join(' '))colors.set(b[1],a[1])}}
      text=text.replace(/^([1-5]) (-?\d+)(?=\s)/gm,(line,type,code)=>type+' '+(colors.get(code)||code));
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

