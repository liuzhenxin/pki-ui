# Gemini Project Context: PKI-UI (RuoYi-Vue-Plus based)

This project is a specialized Public Key Infrastructure (PKI) management interface built on the **RuoYi-Vue-Plus** (Vue 3 + TS) template. It provides tools for Certificate Authority (CA) management, certificate issuance, and profile configuration.

## Project Overview

-   **Main Technologies:** Vue 3 (Composition API), TypeScript, Vite, Element Plus, Pinia.
-   **Security/PKI:** Custom integration for CA management (`/ca/api/v1/...`). Uses `jsrsasign`, `node-forge`, `sm-crypto`, and `jsencrypt` for cryptographic operations.
-   **Styling:** UnoCSS (atomic CSS), SCSS.
-   **Architecture:**
    -   `src/api/`: Modular API definitions (e.g., `ca/root.ts`, `ca/profile.ts`).
    -   `src/views/`: Page components organized by feature (CA, System, Monitor, Workflow).
    -   `src/components/`: Reusable UI components, including PKI-specific ones like `X509Cert` and `CertProfile`.
    -   `src/store/`: Pinia modules for state management (user, app, settings, permission).
    -   `src/utils/`: Core utilities including a robust `request.ts` for API calls.

## Building and Running

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```
-   **Proxy:** The development server proxies API requests to the backend (default: `http://127.0.0.1:5555`) via the path specified in `VITE_APP_BASE_API`.

### Production
```bash
# Build for production
npm run build:prod

# Preview production build locally
npm run preview
```

## Development Conventions

### API Communication
-   **Axios Instance:** Always use the default export from `@/utils/request.ts`.
-   **Authentication:** Requests automatically include `Authorization: Bearer <token>` and `clientid`.
-   **Encryption:** If `VITE_APP_ENCRYPT` is enabled in `.env`, the request/response payloads are encrypted using AES (with keys exchanged via RSA).
-   **Internationalization:** The `Language` header is automatically set based on the user's current locale.

### Coding Standards
-   **TypeScript:** Use strict typing. Avoid `any` where possible, especially in API response types.
-   **Component Structure:** Prefer `<script setup lang="ts">` for Vue components.
-   **Linting:** Run `npm run lint:eslint` before committing. Formatting is handled by Prettier (`npm run prettier`).
-   **Icons:** Uses `unplugin-icons` and `SvgIcon` component. Place new SVGs in `src/assets/icons/svg`.

### PKI Specifics
-   **Certificate Profiles:** Configuration templates are stored/referenced in `profiles/` and managed via `src/api/ca/profile.ts`.
-   **CA Operations:** Logic for root CAs, sub-CAs, and CSR generation is primarily in `src/api/ca/`.

## Key Files
-   `vite.config.ts`: Main build and proxy configuration.
-   `src/utils/request.ts`: Global Axios interceptors for auth, encryption, and error handling.
-   `src/permission.ts`: Route guards and dynamic permission loading logic.
-   `src/main.ts`: Application entry point and plugin registration.
