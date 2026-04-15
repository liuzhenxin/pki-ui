# Architecture

**Analysis Date:** 2025-03-05

## Pattern Overview

**Overall:** Single Page Application (SPA) built with Vue 3, Vite, and Element Plus, following the RuoYi-Vue-Plus template architecture.

**Key Characteristics:**
- **Dynamic Routing:** Routes are generated dynamically based on backend menu configuration and user permissions.
- **Modular Design:** Clear separation between API, State (Pinia), and View layers.
- **Cryptographic Security:** Integrated support for CA management, payload encryption (AES/RSA), and various crypto libraries (`jsrsasign`, `node-forge`, `sm-crypto`).

## Layers

**View Layer:**
- Purpose: UI implementation and local state management.
- Location: `src/views/`
- Contains: Vue SFCs (Single File Components) using `<script setup lang="ts">`.
- Depends on: `src/api/`, `src/store/`, `src/components/`, `src/hooks/`.
- Used by: Vue Router.

**State Management Layer:**
- Purpose: Global application state and cross-component communication.
- Location: `src/store/`
- Contains: Pinia store modules.
- Depends on: `src/api/`, `src/utils/`.
- Used by: `src/views/`, `src/permission.ts`, `src/layout/`.

**API Layer:**
- Purpose: Backend communication and data fetching.
- Location: `src/api/`
- Contains: Modular TypeScript files defining request functions.
- Depends on: `src/utils/request.ts`.
- Used by: `src/views/`, `src/store/`.

**Utility Layer:**
- Purpose: Shared helper functions and global configurations.
- Location: `src/utils/`
- Contains: Auth helpers, crypto functions, request interceptors, and common validators.
- Depends on: External libraries (`axios`, `js-cookie`, `crypto-js`).
- Used by: All other layers.

## Data Flow

**Standard Request Flow:**

1. **User Interaction:** A user triggers an action in a `src/views/` component.
2. **API Call:** The component calls a function from `src/api/`.
3. **Request Interceptor:** `src/utils/request.ts` adds authorization headers, handles payload encryption (if enabled), and logs the request.
4. **Backend Processing:** The request is sent to the backend.
5. **Response Interceptor:** `src/utils/request.ts` decrypts the response (if needed), handles global error codes (e.g., 401 logout), and extracts the data.
6. **State Update:** The component updates its local state or calls a `src/store/` action to update global state.
7. **UI Update:** Vue's reactivity system updates the UI.

**State Management:**
- **Pinia Stores:** Used for user info, permissions, app settings, and shared data (e.g., dictionaries).
- **Persistent State:** Some state (like tokens) is persisted in Cookies or LocalStorage via `src/utils/auth.ts` and `src/plugins/cache.ts`.

## Key Abstractions

**Axios Instance:**
- Purpose: Centralized HTTP client configuration.
- Examples: `src/utils/request.ts`
- Pattern: Singleton axios instance with interceptors.

**Custom Components:**
- Purpose: Encapsulated UI logic for PKI-specific features.
- Examples: `src/components/X509Cert/index.vue`, `src/components/CertProfile/index.vue`.
- Pattern: Reusable Vue components with props and events.

## Entry Points

**Main Entry:**
- Location: `src/main.ts`
- Triggers: Browser page load.
- Responsibilities: Mounts the Vue app, registers plugins (Pinia, Router, Element Plus, I18n), and loads global CSS.

**Permission Guard:**
- Location: `src/permission.ts`
- Triggers: Navigation changes (Vue Router).
- Responsibilities: Checks for JWT tokens, fetches user info/permissions, and dynamically generates the route table.

## Error Handling

**Strategy:** Global interceptors combined with local try-catch for specific UI feedback.

**Patterns:**
- **Global Interceptor:** `src/utils/request.ts` handles common HTTP status codes (401, 403, 500) and displays notifications via `ElMessage` or `ElNotification`.
- **Dictionary/Constant Error Codes:** `src/utils/errorCode.ts` maps status codes to human-readable messages.

## Cross-Cutting Concerns

**Logging:** Handled via console for development; critical errors displayed via UI notifications.
**Validation:** Element Plus form validation in views; modular validation rules in `src/utils/validate.ts`.
**Authentication:** JWT-based. Tokens stored in cookies and managed via `src/store/modules/user.ts`.
**Internationalization:** Using `vue-i18n`. Locales stored in `src/lang/`.

---

*Architecture analysis: 2025-03-05*
