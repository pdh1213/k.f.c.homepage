// 기존 설치본은 preload 표식이 없으므로 Electron 사용자 에이전트도 확인합니다.
export function detectDesktop(scope=globalThis){
  return scope.kfcDesktop?.isDesktop===true||/\bElectron\/[\d.]+/.test(scope.navigator?.userAgent||'');
}
export const isDesktop=detectDesktop();
