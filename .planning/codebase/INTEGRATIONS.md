# External Integrations

**Analysis Date:** 2025-05-13

## APIs & External Services

**Backend API:**
- RuoYi-Vue-Plus Backend - Core business logic, PKI management, and administrative services.
  - SDK/Client: `axios` in `src/utils/request.ts`
  - Auth: `Authorization: Bearer <token>` and `clientid` from `.env`.

**Hardware/Token Interface:**
- SKF Service (Local Agent) - WebSocket service running at `ws://127.0.0.1:9001` to interface with U-Keys and HSMs via the SKF library.
  - Implementation: `src/api/skf/skf_api.js`

**Visualizations:**
- ECharts - Data charts and reporting in monitor and dashboard views.

**Rich Text:**
- Vue Quill - Content editing in system management modules.

## Data Storage

**Databases:**
- Handled by backend (RuoYi-Vue-Plus).

**File Storage:**
- OSS (Object Storage Service) - Managed through backend API `/resource/oss/*`.
- Implementation: `src/api/system/oss/index.ts`.

**Caching:**
- LocalStorage / SessionStorage - Used via a custom cache plugin for application state (tokens, UI preferences, session data).
- Implementation: `src/plugins/cache.ts`.

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based Authentication provided by the RuoYi-Vue-Plus backend.
  - Implementation: `src/utils/auth.ts`, `src/store/modules/user.ts`.

**Social Login:**
- Supported via backend integrations.
  - Implementation: `src/api/system/social/auth.ts`.

## Monitoring & Observability

**Error Tracking:**
- Standard axios interceptors log errors to the console and display UI notifications via `ElementPlus`.

**Logs:**
- Operations logs and login logs managed via system monitor APIs (`src/api/monitor/operlog/`, `src/api/monitor/loginInfo/`).

## CI/CD & Deployment

**Hosting:**
- Standard static web hosting (Nginx recommended).

**CI Pipeline:**
- Not detected in the frontend repository (likely in the backend repo or external).

## Environment Configuration

**Required env vars:**
- `VITE_APP_BASE_API` - Backend API base URL.
- `VITE_APP_CLIENT_ID` - Client identifier.
- `VITE_APP_ENCRYPT` - Toggle for request/response payload encryption.

**Secrets location:**
- Managed via `.env` files (excluded from source control).

## Security & PKI

**Payload Encryption:**
- RSA + AES - Secure payload exchange between frontend and backend.
- Implementation: `src/utils/crypto.ts`, `src/utils/jsencrypt.ts`, `src/utils/request.ts`.

**SM Cryptography:**
- SM2/SM3/SM4 support for ShangMi standards, commonly used in Chinese PKI systems.
- Implementation: `src/utils/sm2.ts`.

---

*Integration audit: 2025-05-13*
