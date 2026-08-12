# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PKI-UI is the frontend management console for the LCloud PKI Platform. It is built on the **RuoYi-Vue-Plus** admin template (Vue 3 + TypeScript + Element Plus + Vite). The platform provides certificate lifecycle management, key management, license management, and operational monitoring across multiple PKI service modules.

## Commands

```bash
# Install dependencies (use yarn — the project is locked to yarn@1.22)
yarn install --registry=https://registry.npmmirror.com

# Start development server
npm run dev

# Build
npm run build:prod        # production
npm run build:dev         # development

# Lint and format
npm run lint:eslint        # check only
npm run lint:eslint:fix    # auto-fix
npm run prettier           # format all files

# Tests (Playwright, Vitest)
npx playwright test        # run all tests
npx vitest run             # run unit tests
```

## Architecture

### Multi-Tenant Routing

The app serves multiple PKI service modules through a single frontend. Navigation after login is determined by the user's **tenantId**:

| tenantId | Module | Description |
|----------|--------|-------------|
| 1 | OPS / CA | Platform Operations & Certificate Authority |
| 2 | License | License authorization system |
| 3 | KMC | Key Management Center |
| 5 | RA | Registration Authority |
| 6 | OCSP | Online Certificate Status Service |
| 10 | NAS | Network Attached Storage |

Tenant routing logic is in `src/permission.ts`. Each tenant may have an initialization/setup page (`/ca/setup`, `/kmc/setup`, etc.) that is forced when `tenant.status === -1` (uninitialized).

### Dynamic Permission System

Routes are NOT hardcoded statically. The app starts with only `constantRoutes` (login, 404, index, etc.). After login:

1. `useUserStore().getInfo()` fetches the user's permissions from the backend
2. `usePermissionStore().generateRoutes()` calls `/getRouters` API to get the user's menu tree
3. The menu tree is recursively converted into Vue Router routes and added via `router.addRoute()`
4. Button-level permissions are checked via `v-hasPermi` directive using the permissions array

See `src/store/modules/permission.ts` for the dynamic route generation logic.

### Request Layer (`src/utils/request.ts`)

The axios instance in `request.ts` is the single point of all API communication:

- **Auth**: Automatically attaches `Authorization: Bearer <token>` and `clientid` headers
- **Encryption**: When `VITE_APP_ENCRYPT=true`, request/response payloads are AES-encrypted with RSA key exchange (public key in `.env`, private key for decrypting responses)
- **Token refresh**: Automatic silent refresh using the refresh token; queues concurrent requests during refresh
- **Error handling**: 401 → auto logout; other codes → ElMessage error notification
- **Language**: Sets `Language` header based on current locale (`zh-CN` / `en-US`)
- **Blob downloads**: Handles file download responses with loading overlay

Always import and use this instance (default export) for API calls. API modules are organized under `src/api/` by domain (ca/, ra/, kmc/, system/, ops/, etc.).

### PKI-Specific Crypto Dependencies

- **jsrsasign** / **node-forge**: X.509 certificate parsing and ASN.1 handling
- **sm-crypto**: SM2/SM3/SM4 national cryptographic algorithms
- **jsencrypt**: RSA encryption for secure key exchange
- **crypto-js**: AES encryption for payload encryption

### Key Directories

| Path | Purpose |
|------|---------|
| `src/api/` | API definition modules organized by domain (ca, ra, kmc, system, ops, etc.) |
| `src/views/` | Page components, mirrored to API modules by domain |
| `src/components/` | Reusable UI components including PKI-specific ones (`CertSubject`, `CertProfile`, `X509Cert`) |
| `src/store/modules/` | Pinia stores: `user`, `permission`, `app`, `settings`, `tagsView`, `dict`, `notice` |
| `src/utils/` | Core utilities: `request.ts` (axios), `auth.ts` (token), `crypto.ts` (AES), `jsencrypt.ts` (RSA), `sm2.ts` (SM2) |
| `src/router/` | Route definitions; `constantRoutes` are static, the rest are dynamically loaded |
| `src/layout/` | App shell: Sidebar, Navbar, TagsView, AppMain |
| `vite/plugins/` | Custom Vite plugin chain (auto-import, icons, compression, devtools) |
| `tests/` | Playwright e2e/integration tests |
| `profiles/` | CA certificate profile JSON templates |

### Auto-Imports

The project uses `unplugin-auto-import` and `unplugin-vue-components` configured in `vite/plugins/`. Vue APIs (`ref`, `computed`, `watch`, etc.) and Element Plus components are auto-imported — no explicit imports needed in `.vue` files.

## Conventions

- **Component style**: `<script setup lang="ts">` with Composition API
- **Styling**: UnoCSS atomic classes + SCSS; avoid inline styles
- **API calls**: Always use the shared axios instance from `@/utils/request`; define types in `src/api/types.ts` or domain-specific `types.ts`
- **Token management**: Use `getToken()` / `setToken()` from `@/utils/auth`, not direct localStorage access
- **Path alias**: `@/` maps to `src/`
- **Naming**: API modules use kebab-case directories; Vue components use PascalCase or kebab-case
