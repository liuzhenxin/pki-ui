# Technology Stack

**Analysis Date:** 2025-05-13

## Languages

**Primary:**
- TypeScript 5.9.3 - Core application logic and type definitions across the codebase.

**Secondary:**
- Vue 3.5.22 - Component framework (SFC with `<script setup lang="ts">`).
- SCSS 1.93.3 - Styling and theme customization.

## Runtime

**Environment:**
- Node.js >=18.18.0 - Development and build environment.

**Package Manager:**
- yarn 1.22.19
- Lockfile: `yarn.lock` present.

## Frameworks

**Core:**
- Vue 3.5.22 - Primary frontend framework.
- Element Plus 2.11.7 - UI component library.
- Pinia 3.0.3 - State management.

**Testing:**
- Vitest 3.2.4 - Unit and component testing.

**Build/Dev:**
- Vite 6.4.1 - Build tool and development server.
- UnoCSS 66.5.4 - Atomic CSS engine.

## Key Dependencies

**Critical:**
- `axios` 1.13.1 - HTTP client for API communication.
- `jsrsasign` 11.1.0 - PKI library for RSA, ECC, and X.509 operations.
- `node-forge` 1.3.1 - Cryptographic tools for TLS and PKI.
- `sm-crypto` 0.3.13 - ShangMi (SM2/SM3/SM4) algorithms for Chinese standards.
- `jsencrypt` 3.5.4 - RSA encryption and decryption.
- `crypto-js` 4.2.0 - Standard cryptographic algorithms (AES, DES, etc.).

**Infrastructure:**
- `vue-router` 4.6.3 - Application routing.
- `vue-i18n` 11.1.12 - Internationalization support.
- `echarts` 5.6.0 - Data visualization.
- `@vueuse/core` 13.9.0 - Composition API utilities.

## Configuration

**Environment:**
- Configured via `.env`, `.env.development`, and `.env.production`.
- Key configs: `VITE_APP_BASE_API`, `VITE_APP_CLIENT_ID`, `VITE_APP_ENCRYPT`.

**Build:**
- `vite.config.ts` - Main Vite configuration including proxy and plugin setup.
- `tsconfig.json` - TypeScript compiler configuration.

## Platform Requirements

**Development:**
- Node.js >=18.18.0
- Yarn or NPM

**Production:**
- Modern browsers (Chrome >= 87, Edge >= 88, Safari >= 14, Firefox >= 78).
- Backend: RuoYi-Vue-Plus compatible API.

---

*Stack analysis: 2025-05-13*
