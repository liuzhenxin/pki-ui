# Coding Conventions: PKI-UI

## TypeScript
- **Strict Mode:** Enabled.
- **Typing:** Use strict typing where possible. Avoid `any`.
- **API Types:** API response types should be defined in `src/api/types.ts` or local `types.ts` files.
- **Casting:** Minimize the use of `as any`. If used, document why.

## Vue 3
- **Composition API:** Always use `<script setup lang="ts">`.
- **Component Naming:** PascalCase for component files (e.g., `X509Cert.vue`).
- **State Management:** Use Pinia for global state. Store modules should be in `src/store/modules/`.
- **Reactivity:** Prefer `ref` for primitives and `reactive` for objects/arrays where appropriate, but `ref` is generally preferred for consistency.

## Styling
- **UnoCSS:** Use atomic CSS for layout, spacing, and simple styling.
- **SCSS:** Use for complex, reusable styles and overriding Element Plus defaults. Global styles are in `src/assets/styles/`.
- **Element Plus:** Primary UI library. Use its components and design tokens.
- **Icons:** Use `unplugin-icons` and the `<svg-icon />` component.

## API Communication
- **Axios:** Use the shared instance in `src/utils/request.ts`.
- **Modular APIs:** Organize API calls by feature in `src/api/`.
- **Encryption:** Be aware of the encryption layer (AES/SM2) configured in `request.ts`.
- **Error Handling:** Use the global interceptors for standard error responses.

## Code Quality
- **Linting:** ESLint is used. Run `npm run lint:eslint` before committing.
- **Formatting:** Prettier is used. Run `npm run prettier` to format the codebase.
