# PKI Management Domain Research: CA and KMC

**Domain:** Public Key Infrastructure (PKI)
**Researched:** 2024-05-22
**Overall confidence:** HIGH

This research covers the management of Certificate Authorities (CA) and Key Management Centers (KMC), focusing on standard workflows, X.509 certificate profiles, and UI-specific operational failure modes.

## 1. Standard Workflows

### 1.1 Certificate Authority (CA) Lifecycle
The CA manages the identity and validity of certificates.

| Stage | Standard Workflow | 2024 Best Practice |
| :--- | :--- | :--- |
| **Registration (RA)** | Identity proofing, CSR validation, and authorization. | Automated identity proofing via IAM/MDM integration. |
| **Issuance** | Signing the certificate and publishing it. | Use **ACME** for automated, short-lived TLS (90 days). |
| **Revocation** | Updating the revocation status (CRL or OCSP). | Transition to **OCSP Stapling** to reduce client-side overhead. |
| **Renewal** | Issuing a new certificate for an existing identity. | **Zero-Touch Renewal**; certificates rotate at 80% of life. |
| **Audit/Logging** | Recording all CA events for compliance. | **Certificate Transparency (CT)** for all public-facing certs. |

### 1.2 Key Management Center (KMC) Lifecycle
The KMC manages the security, escrow, and recoverability of cryptographic keys.

| Feature | Standard Workflow | Security Requirement |
| :--- | :--- | :--- |
| **Key Generation** | Creating key pairs for users/applications. | Must occur within a **FIPS 140-3** or **GM/T Level 3** HSM. |
| **Dual-Key Pair** | Separate keys for **Signing** (Client) and **Encryption** (KMC). | **Signing keys** MUST NOT be escrowed; **Encryption keys** MUST be. |
| **Key Escrow** | Storing the private encryption key securely. | Encryption at rest using **Key Wrapping** (AES-256). |
| **Key Recovery** | Recovering a lost encryption key. | **M-of-N (Dual Control)**; no single admin can recover a key. |
| **Key Archiving** | Long-term storage for historical data decryption. | Offline, redundant storage with periodic integrity checks. |

## 2. Industry-Standard Certificate Profiles (X.509)

Modern X.509 profiles (RFC 5280) emphasize **strictness** and **minimization** to reduce the attack surface.

### 2.1 Critical Extensions
| Extension | Best Practice | Rationale |
| :--- | :--- | :--- |
| **Subject Alternative Name (SAN)** | **Mandatory**; CN is deprecated. | Prevents ambiguity; supports multiple identities (DNS, IP, URI). |
| **Basic Constraints** | `cA=FALSE` for end-entities; `pathLenConstraint` for CAs. | Prevents end-user certs from issuing other certs. |
| **Key Usage (KU)** | `digitalSignature` (and `keyEncipherment` for RSA only). | Limits the key's usage to its intended purpose (e.g., SM2 doesn't need keyEncipherment). |
| **Extended Key Usage (EKU)** | Specific OIDs (e.g., `serverAuth`, `clientAuth`, `codeSigning`). | Prevents misuse (e.g., using a web cert for malware signing). |
| **AIA / CRLDP** | Must include valid OCSP and CRL pointers. | Ensures clients can check revocation status. |

### 2.2 Profile Types
- **TLS Server:** Short validity (90-397 days), `serverAuth` EKU, DNS SANs.
- **S/MIME:** `emailProtection` EKU, rfc822Name SANs, organization/mailbox validation levels.
- **Code Signing:** Long-lived (with timestamping), `codeSigning` EKU, HSM requirement.
- **GuoMi (SM2):** Dual-certificate structure (one for signing, one for encryption).

## 3. Common Operational Failure Modes in Management UIs

PKI systems are complex; UIs often fail to shield users from this complexity or provide adequate feedback.

### 3.1 UI/UX Pitfalls
- **Information Overload:** Displaying OIDs, Thumbprints, and raw PEM data in main dashboards.
- **Vague CSR Failures:** "Error 500" or "Invalid CSR" without explaining *why* (e.g., "Key too short", "Missing SAN").
- **Manual-First Design:** Forcing users to fill 20 fields for a certificate instead of using **Policy Templates**.
- **Color-Only Status:** Relying on red/green dots for health, which is inaccessible and lacks detail.
- **Async Feedback Gap:** Issuing a large CRL can take time; UIs often hang or fail to show progress.

### 3.2 Detection and Prevention
- **Actionable Validation:** Real-time CSR parsing and linting (e.g., using `zlint` patterns).
- **Proactive Expiration Alerts:** Dashboard heatmaps showing "Time-to-Outage" clusters.
- **Automation Status:** Monitoring "ACME/EST Endpoints" instead of individual certs.
- **Template-Driven UI:** Pre-filling extensions based on the selected "Business Profile" (e.g., "Standard Web Server").

## 4. Sources
- **RFC 5280:** Internet X.509 PKI Certificate and CRL Profile.
- **CA/Browser Forum Baseline Requirements:** (TLS, S/MIME, Code Signing).
- **NIST SP 800-57:** Recommendation for Key Management.
- **GM/T 0015-2012:** Digital Certificate Formats based on SM2 (GuoMi).
