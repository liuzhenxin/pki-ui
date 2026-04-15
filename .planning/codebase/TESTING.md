# Testing: PKI-UI

## Testing Framework
- **Vitest:** The primary testing framework for unit and component tests.
- **Configuration:** Managed via `vite.config.ts`.

## Current State
- **Coverage:** Very low. Most features currently lack automated tests.
- **Manual Tests:** Some manual scripts like `test_x509.js` exist in the root for cryptographic verification.

## Testing Strategy
- **Unit Tests:** Focus on utility functions (`src/utils/`) and cryptographic logic.
- **Component Tests:** Use `@vue/test-utils` with Vitest for critical UI components (e.g., `X509Cert`, `CertSubject`).
- **API Mocking:** Use `msw` or simple `vi.mock` for testing API-dependent logic.

## Execution
- **Run Tests:** `npx vitest` (if script is not in `package.json`, though `vitest` is in devDependencies).
- **Watch Mode:** `npx vitest watch`.

## Conventions
- **File Naming:** `[name].test.ts` or `[name].spec.ts`.
- **Location:** Place test files next to the source file or in a `__tests__` directory.
