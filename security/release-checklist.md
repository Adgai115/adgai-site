# Public Release Checklist

Run this checklist before deploying `public-site/`.

## Automated Checks

```powershell
npm run scan
```

## Manual Checks

- No local Windows paths such as `E:\Dev\...`.
- No `.env`, `.git`, `*.log`, `*.jsonl`, backup files, or raw snapshots in the public build.
- No API keys, cookies, tokens, credentials, or bearer strings.
- No Feishu, WebChat, WeChat, or session excerpts.
- No internal service URLs or private ports.
- `public-site/data/public_snapshot.json` contains only allowlisted fields.
- Private console is not deployed as part of the public site.

## Deployment Gate

Deploy only when both automated and manual checks pass.
