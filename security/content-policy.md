# Content Publishing Policy

## Goal

Keep the public personal website and the private AI resource console in the same brand system while keeping them in separate security boundaries.

## Content Classes

| Class | Examples | Public Handling |
| --- | --- | --- |
| Public | Bio, public projects, selected notes, public screenshots | Allowed |
| Internal | Model inventory, tool status, task counts, aggregate cost | Export only as sanitized summaries |
| Secret | API keys, sessions, raw logs, Feishu/WebChat details, local paths, backup paths | Never publish |

## Rules

1. Public pages are built only from `public-site/` files and `public-site/data/public_snapshot.json`.
2. Public exports are allowlist based. A field not listed in `exporter/allowlist.json` is excluded.
3. Private snapshots may contain operational details and must stay under `private-console/snapshots/`.
4. No page in `public-site/` may reference `E:\Dev\.openclaw`, OpenClaw logs, raw session files, credentials, or local service ports except in redacted documentation examples.
5. Any generated public content needs a manual review flag before it is copied into a public content directory.

## Recommended Domains

```text
https://adgai.com          public site
https://console.adgai.com  private console behind Access/VPN, if remote access is needed
http://127.0.0.1:18666     safest default for the private console
```

## Private Console Requirements

- Bind to `127.0.0.1` unless protected by VPN or an identity-aware proxy.
- Return `Cache-Control: no-store`.
- Avoid raw logs in HTML.
- Show collection freshness and collection errors explicitly.
- Treat every private API endpoint as private even when the page is local-only.

