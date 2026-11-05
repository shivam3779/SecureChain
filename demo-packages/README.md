# SecureChain Demo Packages

Sample manifest files for demonstrating SecureChain vulnerability scanning, typosquat detection, and CI/CD policy gates.

## 1. Vulnerable App (`vulnerable-app/package.json`)
- **Expected Gate Verdict**: `BLOCKED` (Fail closed)
- **Included Threats**:
  - `lodash@4.17.15`: Critical Prototype Pollution (CVE-2020-28500, CVE-2021-23337)
  - `axios@0.21.1`: SSRF Vulnerability (CVE-2020-28168)
  - `minimist@1.2.0`: Prototype Pollution (CVE-2020-7598)
  - `lodahs@1.0.0`: Typosquatting attack against top npm package `lodash` (Levenshtein distance 2)

## 2. Clean App (`clean-app/package.json`)
- **Expected Gate Verdict**: `PASS` (Risk Score 100)
- **Included Dependencies**:
  - `express@^4.21.0`
  - `lodash@^4.17.21`
  - `axios@^1.7.7`
  - `jsonwebtoken@^9.0.2`

## How to Test in SecureChain Dashboard
1. Open **Repositories** → **Paste manifest** tab.
2. Click **"Load Vulnerable Demo"** or upload `vulnerable-app/package.json`.
3. Click **Scan Manifest**.
4. Observe real-time CycloneDX SBOM generation, CVE risk scoring, and policy gate evaluation.
