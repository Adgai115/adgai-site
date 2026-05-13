# Adgai Site

This repository is a split public/private website scaffold for the Adgai personal site and local AI resource console.

## Layout

```text
public-site/
  Static public website. It only reads sanitized data from data/public_snapshot.json.

private-console/
  Local-only resource console. It collects private OpenClaw resource status and serves it on 127.0.0.1.

exporter/
  Sanitizes private snapshots into a small public snapshot using an allowlist.

security/
  Publishing policy, release checklist, and security notes.
```

## First Run

Generate the public snapshot from the private collector:

```powershell
npm run build
```

Start the public preview:

```powershell
npm run public:serve
```

Start the private console:

```powershell
npm run private:serve
```

Public preview: http://127.0.0.1:8080/

Private console: http://127.0.0.1:18666/

## Security Boundary

The public site must never read OpenClaw directories directly. Public data flows only through:

```text
private collectors -> private_snapshot.json -> exporter allowlist -> public_snapshot.json -> public-site
```

## Operations

See [docs/operations-manual.md](docs/operations-manual.md) for daily startup, restart, release, health check, troubleshooting, and rollback procedures.
