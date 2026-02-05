# 공개 대기실 — Upstash Redis 설정

공개 대기실의 **방 목록**은 Upstash Redis에 저장됩니다.  
로컬에서는 환경 변수를 넣지 않으면 **메모리**로 동작하며, **Vercel 배포 시** Redis 설정을 권장합니다.

---

## 1. Upstash Redis 만들기

1. [Upstash Console](https://console.upstash.com/) 접속 후 로그인(또는 회원가입).
2. **Create Database** 클릭.
3. **Name**: 예) `ax-game-rooms`  
   **Region**: Vercel 리전과 가깝게(예: `ap-northeast-2`).  
   **Type**: Redis.
4. **Create** 후 생성된 DB 선택.

---

## 2. 환경 변수 복사

DB 상세 페이지에서:

- **REST API** 섹션의 **UPSTASH_REDIS_REST_URL**
- **UPSTASH_REDIS_REST_TOKEN**

두 값을 복사합니다.

---

## 3. 로컬에서 사용

프로젝트 루트에 `.env.local` 파일을 만들고 다음을 넣습니다.

```env
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...
```

저장 후 `npm run dev`로 실행하면 방 목록이 Redis에 저장·조회됩니다.

---

## 4. Vercel에서 사용

1. Vercel 대시보드 → 해당 프로젝트 → **Settings** → **Environment Variables**.
2. 변수 추가:
   - **Name**: `UPSTASH_REDIS_REST_URL`  
     **Value**: 위에서 복사한 URL  
     **Environment**: Production, Preview, Development 모두 체크.
   - **Name**: `UPSTASH_REDIS_REST_TOKEN`  
     **Value**: 위에서 복사한 토큰  
     **Environment**: Production, Preview, Development 모두 체크.
3. **Save** 후 필요하면 **Redeploy** 실행.

---

## 5. 미설정 시 동작

- **UPSTASH_REDIS_REST_URL**, **UPSTASH_REDIS_REST_TOKEN**이 하나라도 없으면:
  - **로컬**: 앱 메모리에만 방 목록이 저장됩니다(재시작 시 초기화).
  - **Vercel**: 마찬가지로 서버리스 함수가 실행되는 동안만 메모리에 유지되므로, 배포 환경에서는 **Redis 설정을 하는 것을 권장**합니다.

---

## 참고

- [Upstash Redis 문서](https://upstash.com/docs/redis)
- [Vercel + Upstash 연동](https://vercel.com/integrations/upstash)
