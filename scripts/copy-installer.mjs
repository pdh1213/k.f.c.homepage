import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'release', 'KFC-Club-Setup.exe');
const destination = path.join(root, 'outputs', 'KFC-Club-Setup.exe');
try {
  await fs.access(source);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
  console.log(`Windows 설치 파일 복사 완료: ${path.relative(root, destination)}`);
} catch {
  console.error('Windows 설치 파일이 없습니다. Windows NSIS 빌드가 성공한 뒤 다시 실행해 주세요.');
  process.exitCode = 1;
}
