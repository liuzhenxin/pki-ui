# Feature Landscape: PKI-UI

**Domain:** PKI (CA/KMC) Management
**Researched:** 2024-05-22

## Table Stakes

Foundational features for any PKI management system.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Cert Issuance** | Core function of a CA. | High | Must support CSR (PKCS#10) parsing and signing. |
| **Revocation (CRL/OCSP)** | Vital for trust management. | Medium | CRL generation can be slow; needs background job monitoring. |
| **Profile Management** | Prevents misconfiguration. | Medium | X.509 extensions (SAN, KU, EKU) should be templated. |
| **Key Escrow (KMC)** | Core function of KMC. | High | Encryption keys must be securely stored and recoverable. |
| **User/RA Management** | Access control to CA ops. | Low | Standard RBAC from RuoYi-Vue-Plus. |

## Differentiators

Features that provide a modern competitive edge.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **GuoMi (SM2) Dual-Key** | Chinese compliance. | High | Support for separate signing/encryption certs. |
| **Automation Visibility** | Handles short lifespans. | Medium | Dashboard for ACME/EST client health. |
| **Expiration Heatmap** | Proactive outage prevention. | Medium | Visualizes clusters of expiring certificates. |
| **One-Click Distrust** | Crypto-agility. | Medium | Rapid bulk revocation/rotation of compromised Sub-CAs. |
| **PQC Readiness** | Future-proofing. | High | Indicators/support for ML-KEM and ML-DSA algorithms. |

## Anti-Features

Explicitly avoided features.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Signing Key Escrow** | Breaks non-repudiation. | Escrow only encryption keys; keep signing keys local to user/HSM. |
| **Manual SAN Entry** | Error-prone. | Use a list-based UI with validation for DNS/IP formats. |
| **Long-Lived TLS (2y+)** | Violates CA/B Forum rules. | Limit validity to 397 days (or 90 for 2024+ best practice). |

## Feature Dependencies

```
Profile Management → Certificate Issuance (Issuance uses profiles)
Key Escrow (KMC) → Encryption Certificate Issuance
Audit Logging → All Administrative Actions
```

## MVP Recommendation

**Prioritize:**
1.  **Template-Based Issuance:** Move from manual forms to selecting "Web Server", "S/MIME", or "SM2-Dual" profiles.
2.  **Basic KMC Escrow:** Secure storage and recovery of encryption keys with Dual Control.
3.  **Unified Expiry Dashboard:** A single view showing all certificates expiring in the next 30/60/90 days.

**Defer:**
-   **PQC Integration:** High complexity, low immediate demand until NIST standards are fully finalized in mid-2024.
-   **Native ACME Client:** Complex to build; start by providing a dashboard to monitor external ACME clients.

## Sources
- **CA/Browser Forum Baseline Requirements.**
- **NIST SP 800-57 Part 1.**
- **GM/T 0015-2012 (SM2 Formats).**
