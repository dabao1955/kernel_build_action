# Security Policy

## Supported Versions

| Version         | Supported  |
| --------------- | ---------- |
| `@v1`           | ✅         |
| `@latest`       | ✅         |
| `@main`         | ⚠️ [^1]    |
| Historical Tags | ❌ [^2]    |


## Reporting a Vulnerability

If you discover a vulnerability in this GitHub Action, please report it using one of the following methods:

1. **GitHub Security Advisories**: Submit a private report using the [GitHub Security Advisories](https://github.com/dabao1955/kernel_build_action/security/advisories).
2. **Email**: For sensitive vulnerabilities, contact us at dabao1955@163.com.
3. Include the following details in your report:
   - Affected GitHub Action version(s) or tags.
   - Steps to reproduce the issue.
   - Description of the potential impact (e.g., token exposure, privilege escalation).

We aim to respond within 48 hours and resolve the issue as quickly as possible.

---

## Security Guidelines

To ensure the safe use of this GitHub Action:

1. Use the least privilege principle:
   - Configure `GITHUB_TOKEN` or other secrets with the minimal required permissions.
   - Use a personal access token (PAT) only if strictly necessary.
2. Pin your GitHub Action to a specific version or tag:
   ```yaml
   uses: dabao1955/kernel_build_action@v1

---
## Note
[^1]: The `@main` tag may include experimental or unstable changes. It is recommended to use stable tags such as `@v1` in production workflows.
[^2]: Due to limitations of git, we cannot make modifications on the released version.
