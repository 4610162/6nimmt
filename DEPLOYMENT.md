# 배포 가이드: Vercel + PartyKit Cloud

Next.js 앱은 **Vercel**에, 실시간 게임 서버(PartyKit)는 **PartyKit Cloud**에 각각 배포합니다.  
클라이언트는 환경 변수 `NEXT_PUBLIC_PARTYKIT_HOST`로 연결할 PartyKit 주소를 사용합니다.

---

## 사전 준비

- [GitHub](https://github.com) 계정
- [Vercel](https://vercel.com) 계정 (GitHub 로그인 가능)
- 프로젝트가 GitHub 저장소에 푸시되어 있어야 함

---

## 1단계: PartyKit 서버 배포 (PartyKit Cloud)

1. **터미널에서 프로젝트 폴더로 이동**
   ```bash
   cd c:\Users\tmlee\Desktop\Shinhan_AX
   ```

2. **PartyKit 배포 실행**
   ```bash
   npx partykit deploy
   ```

3. **최초 실행 시**
   - 브라우저가 열리면 **GitHub로 로그인** 후 PartyKit 권한 허용
   - 배포가 끝나면 터미널에 **PartyKit URL**이 출력됨  
     형식: `[프로젝트이름].[GitHub사용자명].partykit.dev`  
     예: `ax-game.myusername.partykit.dev`

4. **이 URL을 복사해 두기** (호스트만 사용, `https://` 없이)
   - 예: `ax-game.myusername.partykit.dev`

5. **(선택) 로그 확인**
   ```bash
   npx partykit tail
   ```

---

## 2단계: Next.js 앱 배포 (Vercel)

1. **Vercel 로그인**  
   https://vercel.com → **GitHub로 로그인**

2. **프로젝트 가져오기**
   - **Add New…** → **Project**
   - GitHub 저장소에서 **Shinhan_AX** (또는 해당 저장소) 선택
   - **Import** 클릭

3. **환경 변수 설정 (필수)**
   - **Environment Variables** 섹션에서:
   - **Name**: `NEXT_PUBLIC_PARTYKIT_HOST`
   - **Value**: 1단계에서 복사한 PartyKit 호스트  
     예: `ax-game.myusername.partykit.dev`
   - **Environment**: Production, Preview, Development 모두 체크 권장
   - **Save** 클릭

4. **배포 실행**
   - **Deploy** 클릭
   - 빌드가 끝나면 **배포 URL**이 생성됨 (예: `https://shinhan-ax-xxx.vercel.app`)

5. **동작 확인**
   - 배포 URL로 접속 → "새 게임 시작" → 방 입장 후 게임이 정상 동작하는지 확인

---

## 3단계: 동작 정리

| 환경       | PartyKit 연결 주소 |
|------------|----------------------|
| 로컬 개발  | `localhost:1999` (기본값, 별도 설정 없음) |
| Vercel 배포 | `NEXT_PUBLIC_PARTYKIT_HOST`에 넣은 PartyKit Cloud 호스트 |

- **로컬**: `NEXT_PUBLIC_PARTYKIT_HOST`를 설정하지 않으면 자동으로 `localhost:1999` 사용
- **Vercel**: 반드시 `NEXT_PUBLIC_PARTYKIT_HOST`에 PartyKit Cloud 호스트를 설정해야 실시간 게임이 동작함

---

## 문제 해결

- **"서버에 연결 중..."에서 멈춤**
  - Vercel 프로젝트에 `NEXT_PUBLIC_PARTYKIT_HOST`가 올바르게 설정되었는지 확인
  - 값은 `https://` 없이 **호스트만** (예: `ax-game.myusername.partykit.dev`)
  - 환경 변수 수정 후 **Redeploy** 한 번 실행

- **PartyKit 배포 실패**
  - `npx partykit deploy` 다시 실행
  - GitHub 로그인/권한 허용이 완료되었는지 확인

- **배포 후 코드 수정 시**
  - Vercel: GitHub에 푸시하면 자동 재배포 (또는 대시보드에서 Redeploy)
  - PartyKit: 코드 변경 후 다시 `npx partykit deploy` 실행

---

## PartyKit 대시보드 500 오류 시: Cloudflare 직접 배포 (우회)

`npx partykit deploy` 실행 시 브라우저에서 **dashboard.partykit.io** 로그인 페이지가 열리고  
**500 MIDDLEWARE_INVOCATION_FAILED** 오류가 나는 경우, PartyKit 로그인 없이 **본인 Cloudflare 계정**에 직접 배포할 수 있습니다.

### 사전 준비

- [Cloudflare](https://dash.cloudflare.com) 계정
- Cloudflare에 연결된 **도메인** 1개 (예: `example.com` → 서브도메인 `ax-game.example.com` 사용)  
  - 도메인이 없다면: [Freenom](https://www.freenom.com)(무료 도메인) 또는 [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) 등으로 도메인을 준비한 뒤 Cloudflare에 추가하면 됩니다.

### 1. Cloudflare 정보 확인

1. **Account ID**  
   - [Cloudflare 대시보드](https://dash.cloudflare.com) → 아무 도메인 선택 → 오른쪽 **API** 섹션의 **Account ID** 복사

2. **API Token**  
   - [API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**  
   - **Edit Cloudflare Workers** 템플릿 사용 또는 권한에 Workers 편집 포함  
   - 생성된 토큰 복사 (한 번만 표시됨)

### 2. 도메인 준비

- Cloudflare에 추가한 도메인에서 **서브도메인** 하나 사용 (예: `ax-game.example.com`)
- 해당 도메인/서브도메인의 DNS는 Cloudflare에서 관리 중이어야 함

### 3. PartyKit을 Cloudflare에 배포

터미널에서 (PowerShell):

```powershell
cd c:\Users\tmlee\Desktop\Shinhan_AX

$env:CLOUDFLARE_ACCOUNT_ID="여기에_Account_ID"
$env:CLOUDFLARE_API_TOKEN="여기에_API_Token"
npx partykit deploy --domain ax-game.example.com
```

- `ax-game.example.com`을 본인 도메인/서브도메인으로 바꾸세요.
- 브라우저 로그인 없이 배포가 진행됩니다.

### 4. 배포 후

- 터미널에 표시되는 배포된 **호스트**(예: `ax-game.example.com`)를 복사합니다.
- **2단계: Next.js 앱 배포 (Vercel)** 로 가서, 환경 변수 `NEXT_PUBLIC_PARTYKIT_HOST` 값에 이 호스트를 넣습니다 (프로토콜 없이 호스트만).

참고: [PartyKit - Deploy to your own Cloudflare account](https://docs.partykit.io/guides/deploy-to-cloudflare/)