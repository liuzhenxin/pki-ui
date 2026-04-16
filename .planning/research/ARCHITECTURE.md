# Architecture Patterns: PKI-UI

**Domain:** PKI (CA/KMC) Management
**Researched:** 2024-05-22

## Recommended Architecture

The system follows a three-tier architecture with specialized PKI components.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **CA Manager** | Issuance, Revocation, Root CA init. | Profile Manager, HSM-backed Service. |
| **KMC Service** | Key generation, Escrow, M-of-N recovery. | CA Manager, Audit Logger. |
| **Profile Manager** | Template definition (X.509 extensions). | CA Manager (for validation/policy enforcement). |
| **Monitoring Dashboard**| Automation health, Expiration heatmaps. | Backend Monitoring APIs. |

### Data Flow

1.  **Request:** User submits a CSR or requests a new key via a Profile Template.
2.  **Validation:** Profile Manager ensures CSR/request meets policy (SAN, KU, EKU).
3.  **Process (CA):** Backend signs the cert; UI polls for completion if async.
4.  **Process (KMC):** Backend generates key pair; escrow encryption key; return key package.
5.  **Storage:** Public certs published to inventory; private keys remain in HSM or with user.

## Patterns to Follow

### Pattern 1: Async Job Monitoring
Large operations (e.g., generating a CRL with 1M entries) must be asynchronous.
**What:** Polling or WebSocket-based status updates for long-running PKI tasks.
**Example:**
```typescript
const { status, progress } = useCrlGeneration(crlId);
// UI shows a progress bar or background notification
```

### Pattern 2: Template-Driven UI (Policy)
Don't build fixed forms for certificates.
**What:** Dynamically generate the certificate request form based on the selected Profile OID.
**When:** For all issuance workflows.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Final Signing
**What:** Performing the final CA signature in the browser.
**Why bad:** Exposes CA private key (unless using a client-side HSM, which is rare for server-side PKI).
**Instead:** Browser generates CSR; Backend signs with Root/Sub-CA.

### Anti-Pattern 2: P12/PFX Parsing in Main Thread
**What:** Parsing large certificate bundles in the UI thread.
**Why bad:** Freezes the UI for complex certificate chains.
**Instead:** Use Web Workers for intensive cryptographic parsing/generation.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **CRL Size** | In-memory processing. | Database-backed indexing. | Delta-CRLs and high-perf OCSP. |
| **Key Generation** | Software-based. | Shared Cloud HSM. | Dedicated HSM cluster per region. |
| **Dashboard** | Simple list. | Paginated search. | ElasticSearch for real-time cert discovery. |

## Sources
- **NIST SP 800-57 (Key Management).**
- **IETF RFC 5280 (PKI Architecture).**
