# Technology Stack

**Project:** PKI-UI
**Researched:** 2024-05-22

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vue 3 | ^3.x | UI Library | Modern, reactive, composition API support. |
| TypeScript | ^5.x | Language | Type safety for complex PKI data structures (ASN.1, DER). |
| Element Plus | ^2.x | UI Components | Robust library for admin dashboards (RuoYi standard). |
| Vite | ^5.x | Build Tool | Fast development and optimized production builds. |

### Cryptographic Libraries
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| sm-crypto | ^0.x | GuoMi Algorithms | Support for SM2, SM3, SM4 (required for Chinese PKI). |
| jsrsasign | ^11.x | Certificate Ops | Robust ASN.1 parsing, CSR generation, and cert validation. |
| node-forge | ^1.x | Key/Cert Utilities | Extensive support for PKCS#7, PKCS#10, PKCS#12 formats. |
| jsencrypt | ^3.x | RSA Operations | Lightweight RSA implementation for simple enc/dec tasks. |

### Supporting Tools
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| UnoCSS | ^0.x | Atomic CSS | Fast, flexible styling with low runtime overhead. |
| Pinia | ^2.x | State Mgmt | Managing user sessions, CA/KMC state, and preferences. |
| Axios | ^1.x | API Requests | Standardized communication with backend endpoints. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Crypto | `jsrsasign` | `pkijs` | `pkijs` is powerful but has a steeper learning curve; `jsrsasign` is more common in RuoYi templates. |
| Icons | `unplugin-icons` | `font-awesome` | `unplugin-icons` is more efficient (tree-shaking) and integrates well with Vite. |

## Installation

```bash
# Core
npm install vue typescript element-plus pinia axios

# Crypto (Essential for PKI)
npm install sm-crypto jsrsasign node-forge jsencrypt

# Dev dependencies
npm install -D vite unocss unplugin-icons @types/node-forge @types/jsrsasign
```

## Sources
- **GEMINI.md:** Confirmed current project stack and dependencies.
- **IETF RFC 5280 / 8555:** Guided requirement for crypto-agility and ASN.1 support.
