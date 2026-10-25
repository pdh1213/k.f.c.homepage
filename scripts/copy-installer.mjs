import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
const names=['KFC-Club-Setup-'+version+'.exe','KFC-Club-Setup-'+version+'.exe.blockmap','latest.yml'];
await fs.mkdir(path.join(root,'outputs'),{recursive:true});
for(const name of names)await fs.copyFile(path.join(root,'release',name),path.join(root,'outputs',name));
await fs.copyFile(path.join(root,'release',names[0]),path.join(root,'outputs','KFC-Club-Setup.exe'));
console.log('설치 파일과 자동 업데이트 파일이 outputs에 준비되었습니다.');
