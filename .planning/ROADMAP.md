# Project Roadmap: PKI-UI

## Vision
To provide a secure, modular, and easy-to-use PKI management interface for CA (Certificate Authority) and KMC (Key Management Center) operations, built on modern Vue 3 + TS architecture.

## Milestones

### Milestone 1: Core PKI Lifecycle Management
- **Phase 1: CA Management (Root & Sub-CA)**
  - Support for self-signed and externally signed CA creation.
  - CA authorization profiles.
- **Phase 2: Certificate Issuance & Lifecycle**
  - Issuance from various profiles (TLS, SMIME, Client, etc.).
  - CRL (Certificate Revocation List) management.
- **Phase 3: Key Management Center (KMC) - Basic**
  - Archive, reserve, and used key management.
  - Basic key storage strategy management.

### Milestone 2: Security & Operations
- **Phase 1: Advanced Security Features**
  - Browser-based secure key handling (SM2, RSA).
  - Multi-factor authentication (MFA) integration.
- **Phase 2: Comprehensive Audit & Logging**
  - Detailed operation logs for all PKI activities.
  - Audit dashboards for CA operators.
- **Phase 3: Role-Based Access Control (RBAC)**
  - Fine-grained permissions for CA/KMC operations.

### Milestone 3: Quality & Performance
- **Phase 1: Test Coverage**
  - Implement unit tests for all cryptographic utilities.
  - E2E tests for core issuance workflows.
- **Phase 2: Performance Optimization**
  - Optimize large certificate list loading and rendering.
  - Improve encryption/decryption performance.
- **Phase 3: Internationalization (i18n)**
  - Complete zh-CN/en-US translations for all PKI-specific terms.

## Success Criteria
- [ ] 100% of core PKI lifecycle operations are available via UI.
- [ ] Automated test coverage for critical crypto logic.
- [ ] Zero critical security vulnerabilities in key handling.
- [ ] Successful audit of CA/KMC operation logs.
