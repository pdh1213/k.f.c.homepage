# K.F.C. Chat

용인시청소년수련관 로봇동아리 K.F.C. 회원용 Windows 1:1 채팅 앱과 다운로드 안내 페이지입니다.

- Windows 앱은 기존 홈페이지의 Supabase 로그인 API를 이용합니다. 승인된 계정은 로그인 후 친구 목록과 최근 채팅 목록을 이용할 수 있습니다.
- 채팅은 홈페이지의 기존 대화와 별도의 테이블에 보관됩니다. 대화 내용을 이용할 수 있는 계정은 해당 대화의 두 당사자입니다. 앱은 접속 중 약 4초마다 새 메시지를 확인합니다.
- 앱은 로그인 세션을 실행 중에만 메모리에 유지합니다.
- Vercel은 `public/` 디렉터리만 제공합니다. 채팅은 Supabase의 앱 API에서 처리합니다.
- 설치 파일은 현재 코드 서명 없이 배포합니다. Windows 10 또는 11 x64에서 시작 메뉴의 K.F.C. Chat을 열 수 있습니다.

## Windows 빌드

64비트 Windows에서 `powershell -NoProfile -File scripts/build-windows.ps1`을 실행하면 `outputs/KfcChat.exe`와 `public/KFC-Chat-Setup.exe`가 생성됩니다. Windows에 포함된 .NET Framework 컴파일러를 사용합니다. 설치 프로그램은 현재 Windows 사용자에 설치합니다.

## 배포

Vercel 프로젝트 이름은 `kfcchat`이며 `vercel.json`의 출력 디렉터리를 배포합니다. Supabase는 기존 K.F.C. 홈페이지와 같은 프로젝트를 사용합니다. `supabase/kfc-chat-desktop.sql`을 적용하고 `supabase/functions/kfc-chat-desktop/index.ts`를 배포합니다. 함수가 Supabase Auth에서 직접 세션을 검증하므로 배포 시 `verify_jwt=false`를 사용합니다. Windows 앱에는 Supabase 공개 키만 포함됩니다.
