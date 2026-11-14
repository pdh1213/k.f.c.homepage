# K.F.C. 로봇동아리 공식 홈페이지

버전 3.1.0: Freeform 보드와 프로젝트 시작 흐름, 관리자 전용 채팅·보드 열람, 가입 이용 동의를 추가했습니다. 사용자 지정 마우스 커서는 제거하고 제공된 라이트·나이트 유리 스위처로 교체했습니다. 운영 데이터베이스 마이그레이션은 적용했습니다. 실제 웹·Windows 배포 상태는 Vercel 배포와 GitHub `windows-latest` 릴리스에서 확인하세요.

현재 버전 3.0.13: 리퀴드 글라스 커서와 챗봇 사진·링크 버튼을 추가했습니다. Windows 앱 다운로드 질문에는 바로 이동 버튼을 보여줍니다.

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

새로운 회원 기능은 같은 릴리스에서 데모 체험 화면에도 반영합니다. 3.0.1부터 My Projects 데모에서 프로젝트 종류·공동 제작자·진행 기록·진행 상태를 입력하고 쇼룸 카드로 미리 볼 수 있습니다. 데모 입력은 실제 회원 프로젝트와 분리되며 새로고침하면 사라집니다. 새 버전의 변경 안내는 웹사이트와 Windows 앱에서 기기별로 한 번 표시합니다.

3.0.2부터 그룹 채팅과 1:1 대화의 입력 중 표시를 기존 비공개 Realtime Broadcast 채널에서 전송합니다. 입력 내용은 Broadcast에 포함하지 않고 사용자 ID와 시작·중지 상태만 보냅니다. 잠시 입력이 없거나 연결이 끊기면 표시가 사라집니다. 데모에는 서버 연결이 없는 예시 입력 중 표시와 체험 버튼이 있습니다.

3.0.3부터 일정 시작·종료, 임원 회의, 설문 날짜 응답, 프로젝트 진행 기록의 날짜 입력은 `components/ui/calendar-date-picker.tsx`를 사용합니다. 버튼을 누르면 달력 팝오버가 열리고 월·연도를 바꿀 수 있습니다. 시간까지 필요한 입력은 같은 팝오버에서 시간을 설정합니다. 데모 설문·그룹 일정·프로젝트 기록도 같은 컴포넌트를 사용합니다.

3.0.4부터 첫 쇼룸 방문 시 `public/kfc-logo.png`를 사용한 유리 리빌 애니메이션을 표시합니다. WebGL2를 사용할 수 없거나 움직임 줄이기 설정이 켜진 환경에서는 정지 로고를 보여주며, 로딩이 지연되어도 자동으로 쇼룸으로 넘어갑니다. 웹사이트와 Windows 앱은 같은 배포 화면을 사용합니다.

3.0.8에서는 공개 쇼룸에 동아리 챗봇을 추가했습니다. 간편 질문은 바로 답변하며, 방문자의 추가 질문은 관리자 챗봇 관리 탭에서 답변할 수 있습니다. 질문 확인 번호는 방문자 브라우저에 저장됩니다.

3.0.9에서는 쇼룸 챗봇을 흰 카드형 UI로 바꾸고 해·달 화면 모드 버튼을 추가했습니다. 화면 모드 설정은 기기별로 저장됩니다.

3.0.10에서는 해·달 버튼을 더 작게 만들고 쇼룸 상단 메뉴에 배치했습니다. 다른 화면에서도 상단 조작과 간격을 두었습니다.

3.0.11에서는 마우스용 둥근 삼각형 커서를 추가하고 로딩 상태에 세 점 애니메이션을 적용했습니다. 터치 기기는 기본 조작을, 입력칸은 글자 커서를 유지합니다.

3.0.12에서는 커서 크기와 윤곽을 단순화하고 밝은·어두운 화면에서 보이도록 조정했습니다.

3.0.7에서는 회원이 My Projects에서 게시된 관련 작품을 선택하고, 관리자가 대회 기록에 게시된 프로젝트를 연결할 수 있습니다. 쇼룸의 작품 상세와 대회 기록에서 연결된 작품을 바로 열 수 있으며 데모에서도 예시로 체험할 수 있습니다.

3.0.6에서는 쇼룸의 웹앱·로봇 프로젝트 폴더 모서리에서 사각형 배경이 드러나지 않도록 다듬었습니다.

3.0.5부터 가입 신청 성공 시 승인 대기 상태와 이후 로그인 방법을 확인 팝업으로 안내합니다. Windows 앱에서는 쇼룸의 설치 메뉴를 숨기며, 일반 브라우저에서는 계속 설치 화면으로 이동할 수 있습니다.

### 선택적 shadcn·Tailwind·TypeScript 설정

현재 저장소는 `components/ui`에 TSX 컴포넌트를 두고 Vite가 이를 변환하지만, 전체 앱은 JSX와 일반 CSS를 사용하며 shadcn·Tailwind·TypeScript 타입 검사를 아직 설정하지 않았습니다. 새 `MessageLoading` 컴포넌트는 외부 의존성 없이 기존 CSS에서도 동작합니다. 전체 프로젝트를 해당 구성으로 옮기려면 `npm install -D typescript @types/react @types/react-dom`, `npm install tailwindcss @tailwindcss/vite`, `npx shadcn@latest init`을 순서대로 실행하고, `tsconfig.json`에 `@/*` 경로 별칭, `vite.config.js`에 `@` 별칭과 Tailwind 플러그인, 공용 CSS에 `@import "tailwindcss";`를 설정하세요. 앱 JSX 파일은 검증하면서 TSX로 옮겨야 합니다.

## 3.0 쇼룸과 프로젝트 승인

- 공개 경로 / 또는 /showroom에서 K.F.C. 애니메이션 뒤 쇼룸을 볼 수 있습니다. 로그인은 /login, Windows 다운로드는 /download입니다.
- 승인 회원은 My Projects에서 로봇 또는 웹앱 종류를 선택하고 대표 사진과 설명을 올려 승인 신청할 수 있습니다. 웹앱은 사용방법과 HTTPS URL도 필수입니다.
- /admin의 승인 탭에는 가입 신청과 프로젝트 승인 화면이 있습니다. 쇼룸 관리에서 실제 대회 출전 이력을 등록하거나 공개 여부를 바꿉니다.
- Supabase 마이그레이션 20261030000000_showroom_projects.sql은 프로젝트·대회 테이블과 비공개 project-images 버킷을 만듭니다. 브라우저는 공개 키로 사진을 업로드하고, 서버 전용 키는 Edge Function에만 둡니다.
- 새 프로젝트와 대회 기록은 자동으로 생성되지 않습니다. 관리자 승인 또는 대회 기록 등록 뒤 공개 쇼룸에 나타납니다.

## 3.1.1 Studio 로봇 모델과 사이트 챗봇

- 회원이 로봇 프로젝트에 Studio 2.0 `.io` 모델(최대 20MB)을 선택해 3D 미리보기 후 승인 신청할 수 있습니다. 모델은 비공개 Supabase Storage `project-models`에 저장하고, 승인 전에는 제작자와 관리자에게만 짧은 만료 시간의 열람 URL을 제공합니다. 승인 후 쇼룸의 로봇 카드에서 회전·확대해 볼 수 있습니다. 웹앱 프로젝트에는 모델을 첨부할 수 없습니다.
- `.io`는 Studio의 LDraw 데이터로 읽고, Three.js LDrawLoader로 표시합니다. 색상표는 `public/LDConfig.ldr`에 포함했습니다. 표준 부품 형상은 고정된 [LDraw 부품 라이브러리 미러](https://github.com/kulits/ldraw-parts/tree/c70360d1c588be894997b2168c61909bc8058c4d)에서 브라우저가 가져옵니다. 따라서 3D 보기에는 인터넷 연결이 필요하고, 사용자 정의·비표준 부품은 표시되지 않을 수 있습니다. 이 소프트웨어는 LDraw Parts Library를 사용합니다. 부품 라이브러리의 저작권·라이선스는 [LDraw.org](https://www.ldraw.org/docs-main/licenses/legal-info.html)를 따릅니다.
- 관리자는 프로젝트 승인과 게시된 프로젝트 관리에서 3D 모델을 살펴봅니다. 데모의 `.io` 모델은 화면 메모리에서만 미리보기로 사용하고 서버로 업로드하지 않습니다.
- 관리자는 챗봇 관리에서 대표 질문, 비슷한 표현, 답변, 선택적 이동 버튼을 등록·수정·삭제할 수 있습니다. 접수된 추가 질문을 답변 지식으로 옮길 수도 있습니다. 챗봇은 등록한 표현의 정확 일치와 높은 유사도만 바로 답하고, 확실하지 않으면 기존 관리자 질문함으로 전달합니다. 외부 생성형 AI API는 사용하지 않습니다.
- 배포 순서: `20261114000000_studio_models_and_chatbot_knowledge.sql` 마이그레이션 적용 → `kfc-api` Edge Function 배포 → GitHub/Vercel 웹 배포 → Windows 패키지 3.1.1 배포. Windows 앱은 배포된 웹 화면과 같은 기능·버전을 사용합니다.

