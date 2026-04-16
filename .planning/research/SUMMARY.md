# Research Summary: PKI-UI (CA/KMC)

**Domain:** PKI (Public Key Infrastructure) Management
**Researched:** 2024-05-22
**Overall confidence:** HIGH

## Executive Summary

The PKI-UI project is a specialized management interface for Certificate Authorities (CA) and Key Management Centers (KMC). In 2024, the domain is shifting toward **automation-first** (ACME, EST) and **short-lived lifespans** (90-day TLS). The project's current focus on **GuoMi (SM-crypto)** and **dual-key strategies** (Signing vs. Encryption) aligns with modern security requirements for escrow-capable encryption.

Research highlights that while the core features (issuance, revocation, escrow) are foundational, the user experience must evolve from manual form-filling to **template-driven policy management**. Modern PKI UIs must prioritize **automation visibility** and **proactive alert systems** to handle the increasing velocity of certificate rotation.

Key technical requirements for the roadmap include:
1.  **X.509 Profile Enforcement:** Strict validation of SAN, Key Usage, and EKU based on business templates.
2.  **GuoMi Dual-Key Support:** Proper UI handling for separate signing and encryption certificate requests.
3.  **High-Visibility Dashboards:** Moving away from data-heavy tables to health-centric summaries with drill-down capabilities.

## Key Findings

**Stack:** Vue 3, TS, RuoYi-Vue-Plus, specialized crypto libraries (`sm-crypto`, `jsrsasign`, `node-forge`).
**Architecture:** Multi-layered approach with specialized API modules for CA, KMC, and Profile management.
**Critical pitfall:** Information overload and vague error messaging in complex CSR/Configuration workflows.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Phase 1: Foundation & Compliance** - Standardize X.509 profiles.
   - Addresses: `FEATURES.md` (Table Stakes: Profile mgmt, Cert issuance).
   - Avoids: `PITFALLS.md` (Invalid profile configurations causing interoperability issues).

2. **Phase 2: KMC & Key Escrow** - Implement secure key management.
   - Addresses: `FEATURES.md` (KMC Key Escrow, M-of-N Recovery).
   - Avoids: `PITFALLS.md` (Signing key escrow—ensuring only encryption keys are escrowed).

3. **Phase 3: Automation & UX** - ACME/EST monitoring and dashboard health.
   - Addresses: `FEATURES.md` (Automation Visibility, Expiration Heatmaps).
   - Avoids: `PITFALLS.md` (Information overload, manual rotation fatigue).

**Phase ordering rationale:**
- Compliance and foundational CA features must come first to ensure certificates generated are valid and trusted. KMC follows as a specialized security layer. UX improvements are layered on top once the underlying mechanics are robust.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | well-defined in GEMINI.md and existing code. |
| Features | HIGH | aligned with RFC 5280 and CA/B forum standards. |
| Architecture | MEDIUM | based on typical PKI/RA patterns; backend specifics may vary. |
| Pitfalls | HIGH | common issues documented in PKI community and industry reports. |

## Gaps to Address

- **HSM Integration:** UI needs to reflect if keys are in HSM or software; this requires backend-to-frontend status mapping.
- **PQC Roadmap:** Long-term need to add indicators for Post-Quantum algorithms (ML-KEM/FIPS 203).
- **Audit Logs:** Standardizing audit views to meet WebTrust or GM/T compliance requirements.
