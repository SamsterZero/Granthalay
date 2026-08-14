# Security Policy

## Supported versions

Granthalay is under active development. Security fixes are provided on the latest `main` branch
and, once releases are published, the latest release only.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/SamsterZero/Granthalay/security/advisories/new).
Do not open a public issue for suspected script injection, sanitizer bypass, malicious EPUB,
browser-storage disclosure, service-worker poisoning, or dependency vulnerabilities.

Include the affected commit or version, impact, reproducible steps or a minimal safe EPUB, browser
and operating system, and any suggested mitigation. Do not attach a copyrighted book or unrelated
personal data.

## Response targets

- Initial acknowledgement: within 7 days
- Triage: within 14 days
- Status update: at least every 14 days while remediation is active

Please allow coordinated remediation before public disclosure.

## Scope notes

EPUB files are untrusted input. Granthalay sanitizes markup and resolves archive resources to blob
URLs, but it is not a DRM system or antivirus scanner. Reports about ordinary publisher-layout
differences without a security impact belong in the public issue tracker.
