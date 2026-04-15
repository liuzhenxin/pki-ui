# Codebase Structure

**Analysis Date:** 2025-03-05

## Directory Layout

```
pki-ui/
├── .planning/          # GSD planning and codebase maps
├── profiles/           # Configuration templates for PKI
├── public/             # Static assets (favicon, etc.)
├── src/                # Source code
│   ├── api/            # API request modules
│   ├── assets/         # Static assets (images, styles, icons)
│   ├── components/     # Reusable UI components
│   ├── directive/      # Custom Vue directives
│   ├── enums/          # TypeScript enums (response codes, etc.)
│   ├── hooks/          # Shared Composition API hooks
│   ├── lang/           # Internationalization (i18n) files
│   ├── layout/         # Application layout components
│   ├── plugins/        # Vue plugins and third-party integrations
│   ├── router/         # Vue Router configuration
│   ├── store/          # Pinia state management modules
│   ├── types/          # Global TypeScript type definitions
│   ├── utils/          # Utility functions and helpers
│   └── views/          # Page-level components (business logic)
├── vite/               # Vite configuration and plugins
├── .env.development    # Development environment config
├── .env.production     # Production environment config
├── index.html          # HTML entry point
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── vite.config.ts      # Vite build configuration
```

## Directory Purposes

**src/api/:**
- Purpose: Modularized backend service definitions.
- Contains: Feature-specific subdirectories (e.g., `ca/`, `system/`, `monitor/`).
- Key files: `src/api/ca/root.ts`, `src/api/login.ts`.

**src/views/:**
- Purpose: Main business logic and page components.
- Contains: Subdirectories mirroring the sidebar menu structure.
- Key files: `src/views/ca/root/index.vue`, `src/views/login.vue`.

**src/store/:**
- Purpose: Centralized state management using Pinia.
- Contains: Feature-based modules.
- Key files: `src/store/modules/user.ts`, `src/store/modules/permission.ts`.

**src/components/:**
- Purpose: Reusable UI widgets and business-specific complex components.
- Contains: `X509Cert`, `CertProfile`, `FileUpload`, etc.

**src/utils/:**
- Purpose: Shared logic and helper functions.
- Contains: `request.ts` (axios configuration), `crypto.ts` (encryption), `auth.ts` (token management).

## Key File Locations

**Entry Points:**
- `src/main.ts`: Application initialization and mounting.
- `src/permission.ts`: Global navigation guards and route generation.

**Configuration:**
- `vite.config.ts`: Build system and dev server configuration.
- `src/settings.ts`: Global application settings (title, theme, etc.).

**Core Logic:**
- `src/utils/request.ts`: Global API interceptor and error handling.
- `src/router/index.ts`: Static routes and router instance creation.

**Testing:**
- `test_x509.js`: A script for testing X509 certificate operations (at root).

## Naming Conventions

**Files:**
- Vue Components: PascalCase (e.g., `UserSelect/index.vue`).
- API Modules: camelCase (e.g., `src/api/ca/cert.ts`).
- Utility Files: kebab-case or camelCase (e.g., `scroll-to.ts`).

**Directories:**
- Source Folders: camelCase (e.g., `src/views/ca/`).
- Component Folders: PascalCase (e.g., `src/components/DictTag/`).

## Where to Add New Code

**New Feature (e.g., "KMC Audit"):**
1. Define API endpoints in `src/api/kmc/audit.ts`.
2. (Optional) Create a Pinia store in `src/store/modules/kmc.ts`.
3. Create page components in `src/views/kmc/audit/index.vue`.
4. Add the menu entry in the backend (it will be picked up by `src/permission.ts`).

**New Shared Component:**
- Create a new directory in `src/components/` and place the `index.vue` there.

**New Utility:**
- Add to `src/utils/` if it's general-purpose, or `src/hooks/` if it uses the Composition API.

## Special Directories

**.planning/codebase/:**
- Purpose: Contains codebase maps and architecture documentation for AI agents.
- Generated: No
- Committed: Yes

**profiles/:**
- Purpose: Configuration templates for PKI certificate profiles.
- Committed: Yes

---

*Structure analysis: 2025-03-05*
