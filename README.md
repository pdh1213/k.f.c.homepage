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
4. 관리자 ID는 `admin`입니다. 계정 비밀번호는 Supabase Auth에만 저장되며, 코드·브라우저 번들·공개 저장소에는 넣지 않습니다. 첫 로그인 강제 변경 화면은 표시하지 않습니다.

초기 관리자 계정은 Supabase Auth에서 관리합니다. 처음 로그인해도 별도 비밀번호 변경 창 없이 관리자 화면에 접속할 수 있습니다.

## 배포

### Supabase

마이그레이션은 `supabase/migrations/`에 있습니다. Edge Function `kfc-api`는 Supabase 프로젝트에 배포되어 있습니다. 공개 테이블에 RLS가 켜져 있고, 그룹 Broadcast 채널은 `kfc-group:<groupId>` 토픽을 사용하며 RLS에서 그룹 배정을 검사합니다.

### Vercel

Vercel 프로젝트 `kfc-robot-club`은 Vite, `npm run build`, 출력 디렉터리 `dist`로 배포합니다. 현재 프로덕션 배포는 GitHub 커밋을 지정한 직접 배포입니다. 자동 배포를 쓰려면 Vercel Settings → Git에서 GitHub 로그인 연결을 완료해야 합니다. 환경 변수는 Production·Preview·Development에 설정합니다.

- `VITE_SUPABASE_URL=https://mzlqksaprteljlcjnxix.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase의 공개용 Publishable key
- `VITE_API_BASE_URL`: 선택 사항. 비우면 Supabase Edge Function URL을 사용합니다.

Vercel의 `vercel.app` 주소는 HTTPS를 제공합니다. 커스텀 도메인은 선택 사항이며 필요하면 Vercel에서 도메인과 DNS를 연결합니다. 인터넷에 연결된 다른 기기에서 같은 Supabase 계정과 데이터를 이용할 수 있습니다.

### Windows 앱 다운로드 및 자동 업데이트

Windows x64 / Node.js 22 이상에서 npm ci 후 npm run pack:win을 실행합니다. outputs에 설치 EXE, blockmap, latest.yml이 생성됩니다. 자세한 배포 절차는 [WINDOWS-RELEASE.md](WINDOWS-RELEASE.md)를 참고하세요.

- [Windows 설치 파일](https://github.com/pdh1213/k.f.c.homepage/releases/download/windows-latest/KFC-Club-Setup.exe)
- 앱 기본 홈페이지는 https://kfc-robot-club.vercel.app 이며, 빌드 시 KFC_SERVER_URL 또는 앱의 서버 주소 설정 메뉴에서 변경할 수 있습니다.
- 1.1.0부터 실행 후 및 6시간마다 새 버전을 확인하고 다운로드합니다. 재시작 또는 앱 종료 시 적용하며, K.F.C. → 업데이트 확인으로 직접 확인할 수도 있습니다.
- 기존 1.0.0은 자동 업데이트 코드가 없으므로 새 설치 파일을 한 번 실행해야 합니다. 저장된 서버 주소는 유지합니다. 웹 화면과 서버 데이터는 기존처럼 배포 사이트에서 불러옵니다.
- 앱 내부에서는 Windows 다운로드 버튼을 숨깁니다. 일반 브라우저에는 버튼을 표시합니다.
- GitHub Actions의 Windows installer and automatic updates가 빌드 후 windows-latest 릴리스에 EXE와 blockmap을 올리고 latest.yml을 마지막에 게시합니다. 새 앱 배포 때 package.json의 버전을 올려야 합니다.
- Supabase Function의 KFC_WINDOWS_INSTALLER_URL / KFC_WINDOWS_DOWNLOAD_URL은 다운로드 주소 재정의용입니다. 기본 설치 주소는 위 GitHub 릴리스입니다.

코드 서명 인증서는 아직 설정하지 않았습니다. 최초 설치에서 Windows 보안 경고가 표시될 수 있습니다. Authenticode 인증서와 CSC_LINK / CSC_KEY_PASSWORD 설정을 준비하면 서명 빌드할 수 있습니다. Microsoft Store를 통하지 않는 EXE 배포에는 Store 계정이 필요하지 않습니다.

## 확인한 사항

- `npm run build` 성공
- Supabase 관리자 로그인 응답에서 role=admin 및 mustChangePassword=false 확인
- 비로그인 요청으로 `/admin/overview` 호출 시 HTTP 401 확인
- 인증된 관리자 API `/admin/overview`는 HTTP 200, 비로그인 요청은 HTTP 401을 반환하는 것을 확인했습니다.
- Windows 3.0.0 설치 EXE와 자동 업데이트 파일은 GitHub Releases에 게시했습니다. 실제 사용자 기기의 구버전 → 신버전 교체는 별도 확인이 필요합니다.

## 데모 모드
관리자 `/admin` → `설정`에서 데모 모드를 켜거나 끕니다. 켜진 동안 비회원 로그인 화면에 `데모 모드 접속하기`가 표시됩니다. 데모의 공지, 일정, 설문, 그룹 채팅, 1:1 대화는 별도 예시 데이터이며 실제 회원 API·채팅방·저장소에 접근하지 않습니다. 입력한 설문·그룹 일정·할 일은 브라우저 메모리에서만 체험하고 새로고침하면 사라집니다. 채팅 전송·파일 첨부는 차단됩니다. 관리자만 서버의 `site_settings.demo_enabled` 값을 바꿀 수 있고, 공개 API는 켜짐 여부만 반환합니다.

## 3.0 쇼룸과 프로젝트 승인

- 공개 경로 / 또는 /showroom에서 K.F.C. 애니메이션 뒤 쇼룸을 볼 수 있습니다. 로그인은 /login, Windows 다운로드는 /download입니다.
- 승인 회원은 My Projects에서 로봇 또는 웹앱 종류를 선택하고 대표 사진과 설명을 올려 승인 신청할 수 있습니다. 웹앱은 사용방법과 HTTPS URL도 필수입니다.
- /admin의 승인 탭에는 가입 신청과 프로젝트 승인 화면이 있습니다. 쇼룸 관리에서 실제 대회 출전 이력을 등록하거나 공개 여부를 바꿉니다.
- Supabase 마이그레이션 20261030000000_showroom_projects.sql은 프로젝트·대회 테이블과 비공개 project-images 버킷을 만듭니다. 브라우저는 공개 키로 사진을 업로드하고, 서버 전용 키는 Edge Function에만 둡니다.
- 새 프로젝트와 대회 기록은 자동으로 생성되지 않습니다. 관리자 승인 또는 대회 기록 등록 뒤 공개 쇼룸에 나타납니다.

