# Roadmap

The public [Granthalay Roadmap](https://github.com/users/SamsterZero/projects/5) and GitHub issues
hold live scope. This page records release outcomes only.

| Release  | Outcome                                      |
| -------- | -------------------------------------------- |
| `v0.1.0` | Reliable local reader                        |
| `v0.2.0` | High-quality reading                         |
| `v0.3.0` | Portable library and data ownership          |
| `v0.4.0` | Optional accounts and secure API integration |
| `v0.5.0` | Catalog, storefront, and publisher workflows |
| `v0.6.0` | Payments, orders, and entitlements           |
| `v0.7.0` | Commercial and browser security hardening    |
| `v1.0.0` | Production bookstore launch                  |

The PWA remains in this repository. The modular backend lives in
[`SamsterZero/granthalayapi`](https://github.com/SamsterZero/granthalayapi) and deploys independently.
Backend milestones deliver stable contracts before their corresponding PWA integration milestones:

- backend `v0.1.0` and `v0.2.0` unblock PWA `v0.4.0`;
- backend `v0.3.0` unblocks PWA `v0.5.0`;
- backend `v0.4.0` unblocks PWA `v0.6.0`; and
- backend `v0.5.0` and PWA `v0.7.0` jointly unblock PWA `v1.0.0`.

Releases have no promised dates. GitHub milestone exit gates and issue dependencies are authoritative.
