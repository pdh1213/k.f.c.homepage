# K.F.C. 로봇동아리 공식 홈페이지

용인시청소년수련관 소속 로봇동아리 K.F.C.의 한국어 회원 포털과 Windows Electron 앱입니다.

## 구성

- React 19 + Vite: 반응형 홈페이지와 관리자 화면
- Supabase Auth: 회원 로그인과 세션 갱신
- Supabase PostgreSQL: 회원 상태, 공지, 일정, 설문, 그룹·메시지·할 일 저장
- Supabase Edge Function `kfc-api`: 가입·승인·관리 API. 각 요청에서 세션과 관리자/그룹 권한을 다시 확인합니다.
- Supabase Realtime private Broadcast: 채팅 및 그룹 협업 변경 알림. 연결 복구 시 저장된 서버 데이터를 다시 불러옵니다.
- Electron + electron-builder: 배포 홈페이지를 서버로 사용하는 Windows 앱

현재 연결된 Supabase 프로젝트는 `mzlqksaprteljlcjnxix`(ap-southeast-1)입니다. 웹 앱은 `VITE_SUPABASE_URL`과 공개용 `VITE_SUPABASE_PUBLISHABLE_KEY`만 사용합니다. Secret/service-role key는 Supabase Edge Function 안에서만 사용하며 브라우저 번들에 넣지 않습니다.

기존 로컬 SQLite 데이터는 Supabase로 자동 이전되지 않습니다. 새로 가입 신청을 받고 승인해야 합니다.

## 로컬 실행

1. Node.js 20 이상에서 `npm install`을 실행합니다.
2. `.env.example`을 참고해 `.env`에 Supabase URL과 Publishable key를 입력합니다.
3. `npm run dev`를 실행하고 `http://localhost:4173`을 엽니다.
4. 관리자 ID는 `admin`입니다. 초기 비밀번호는 비밀 설정으로 전달되었으며, 첫 로그인에서 변경해야 합니다. 실제 비밀번호를 공개 저장소나 브라우저 코드에 넣지 마세요.

초기 관리자 계정은 일회용 해시 토큰을 사용해 Supabase Auth에 만들었습니다. 관리자 API와 관리 화면은 비밀번호 변경을 완료할 때까지 제한됩니다.

## 배포

### Supabase

마이그레이션은 `supabase/migrations/`에 있습니다. Edge Function `kfc-api`는 Supabase 프로젝트에 배포되어 있습니다. 공개 테이블에 RLS가 켜져 있고, 그룹 Broadcast 채널은 `kfc-group:<groupId>` 토픽을 사용하며 RLS에서 그룹 배정을 검사합니다.

### Vercel

GitHub의 `pdh1213/k.f.c.wro2026`를 Vercel 프로젝트 `kfc-robot-club`에 연결합니다. 프로젝트 빌드 설정은 Vite, `npm run build`, 출력 디렉터리 `dist`입니다. 환경 변수는 Production·Preview·Development에 설정합니다.

- `VITE_SUPABASE_URL=https://mzlqksaprteljlcjnxix.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase의 공개용 Publishable key
- `VITE_API_BASE_URL`: 선택 사항. 비우면 Supabase Edge Function URL을 사용합니다.

Vercel의 `vercel.app` 주소는 HTTPS를 제공합니다. 커스텀 도메인은 선택 사항이며 필요하면 Vercel에서 도메인과 DNS를 연결합니다. 인터넷에 연결된 다른 기기에서 같은 Supabase 계정과 데이터를 이용할 수 있습니다.

### Windows 앱 다운로드

Windows x64에서 `npm run pack:win`을 실행하면 `outputs/KFC-Club-Setup.exe` 설치 파일을 만듭니다. 설치 후 서버 주소 입력 화면에서 배포된 홈페이지 URL을 설정하면 웹과 동일한 Supabase 백엔드를 이용합니다.

EXE/ZIP은 크기 때문에 GitHub 소스나 Vercel 배포에 넣지 않습니다. 파일을 공개 HTTPS 저장소에 올린 뒤 Supabase Function Secret에 다음 값을 설정하면 `/download`에 다운로드 링크가 표시됩니다.

- `KFC_WINDOWS_INSTALLER_URL`: Windows 설치 EXE의 공개 HTTPS 주소
- `KFC_WINDOWS_DOWNLOAD_URL`: portable ZIP의 공개 HTTPS 주소

두 값은 현재 비어 있으므로 아직 다운로드할 실행 파일은 게시되지 않았습니다. 코드 서명 없이 설치 파일은 빌드할 수 있으나 SmartScreen 경고를 줄이려면 Authenticode 코드 서명 인증서가 필요합니다. Microsoft Store 게시에는 별도 개발자 계정이 필요합니다.

## 확인한 사항

- `npm run build` 성공
- Supabase Edge Function 로그인 응답에서 관리자 역할과 첫 비밀번호 변경 요구 확인
- 비로그인 요청으로 `/admin/overview` 호출 시 HTTP 401 확인
- 관리자 API는 첫 비밀번호 변경을 요구하므로 계정 변경 후 관리자 CRUD 전체의 원격 확인은 아직 완료하지 못했습니다.
- Windows EXE 다운로드 URL은 파일 저장소가 연결되기 전까지 제공되지 않습니다.

