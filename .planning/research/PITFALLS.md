# Domain Pitfalls: PKI-UI

**Domain:** PKI (CA/KMC) Management
**Researched:** 2024-05-22

## Critical Pitfalls

Mistakes that cause security breaches, compliance failures, or major operational overhead.

### Pitfall 1: Signing Key Escrow
**What goes wrong:** A UI design that accidentally allows or encourages the escrow of "Signing" (non-repudiation) private keys.
**Why it happens:** Attempting to simplify the UI by using a single "Key Request" workflow for both signing and encryption.
**Consequences:** Compromises the non-repudiation property of digital signatures.
**Prevention:** Explicitly separate "Signing Request" (CSR-based) from "Encryption Request" (KMC-generated).
**Detection:** Audit logs showing signing keys stored in the database/HSM backup.

### Pitfall 2: Invalid X.509 Profile Enforcement
**What goes wrong:** Issuing a certificate that is missing a required extension (like SAN) or has conflicting bits (like `keyEncipherment` for ECDSA).
**Why it happens:** Relying on manual input fields instead of strict backend-enforced templates.
**Consequences:** Certificates are distrusted by browsers (e.g., Chrome/Safari) or fail to work in specific clients.
**Prevention:** Use a policy-driven engine that validates CSRs against a rigid template before signing.

### Pitfall 3: Time-Zone Ambiguity in Expiry
**What goes wrong:** Displaying or setting certificate expiry times without explicit UTC/Local differentiation.
**Why it happens:** UI defaults to the user's browser time zone, but the backend/certificate uses UTC.
**Consequences:** Certificates "expire" early or late, causing outages or compliance gaps.
**Prevention:** Always display expiry in UTC with the user's local time as a secondary hover-card.

## Moderate Pitfalls

### Pitfall 1: Information Overload in Dashboards
**What goes wrong:** A dashboard filled with Serial Numbers, OIDs, and Fingerprints.
**Prevention:** Prioritize Common Name, Status (Active/Expired/Revoked), and "Days Until Expiry." Hide technical metadata in a side drawer.

### Pitfall 2: Blocking UI on CRL Generation
**What goes wrong:** The entire management UI hangs while the CA generates a large CRL or signs a batch of certs.
**Prevention:** Implement background tasks with progress indicators and notifications.

## Minor Pitfalls

### Pitfall 1: Color-Blindness in Status Indicators
**What goes wrong:** Using only red/green circles for status.
**Prevention:** Use distinct icons (X, Checkmark, Warning) and text labels.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Cert Issuance** | Missing SAN extensions (deprecated CN usage). | Hard-code SAN inclusion and warn if CN is provided without SAN. |
| **KMC Escrow** | Insecure "M-of-N" implementation in UI. | Use multi-step authorization workflows for any recovery action. |
| **Revocation** | Large CRL download timeouts. | Use paginated CRL views and async generation triggers. |

## Sources
- **WebTrust Principles and Criteria for CAs.**
- **IETF RFC 5280.**
- **OWASP Top 10 (Applied to PKI APIs).**
