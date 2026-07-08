# JWT Key Rotation Guide

> **Algorithm**: RS256 (asymmetric RSA) | **Library**: `jose` | **Key loading**: `PemKeyProvider`

---

## Overview

The IAM service signs JWTs with RS256 — a single RSA private key signs all tokens; one or more RSA public keys can verify them. This asymmetric design enables **zero-downtime key rotation**: the old public key stays in place long enough to verify tokens already in circulation, while the new private key starts signing new tokens immediately.

Every JWT contains a `kid` (Key ID) header claim that identifies which public key to use for verification. Clients and relying parties fetch the current public key set from `GET /.well-known/jwks.json` (cached for 5 minutes via `Cache-Control: public, max-age=300`).

Key configuration at a glance:

| Config var | Purpose |
|---|---|
| `JWT_PRIVATE_KEY_PATH` | Active signing key (private) |
| `JWT_PUBLIC_KEY_PATH` | Active verification key (public) |
| `JWT_ACTIVE_KID` | `kid` claim value for tokens signed with the active key |
| `JWT_PREVIOUS_PUBLIC_KEY_PATH` | Previous public key (optional — enables rotation overlap) |
| `JWT_PREVIOUS_KID` | `kid` claim for the previous key (required if `JWT_PREVIOUS_PUBLIC_KEY_PATH` is set) |

---

## Key Naming Convention

The `kid` format is: **`key-{YYYY-MM}`** (e.g. `key-2026-05`).

Set via `JWT_ACTIVE_KID` in `.env`. Change this value when rotating to a new keypair so that tokens signed with the new key carry the correct `kid`.

---

## Zero-Downtime Rotation Procedure

### Step 1 — Generate a new keypair

**Development** (using the built-in script):

```bash
npx tsx src/scripts/generate-dev-keys.ts
# Outputs: apps/api-iam/keys/private.pem and apps/api-iam/keys/public.pem
```

**Production** (using openssl — see [Production Key Generation](#production-key-generation)):

```bash
openssl genrsa -out new-private.pem 2048
openssl rsa -in new-private.pem -pubout -out new-public.pem
```

Keep the old key files accessible — you will need the old public key in Step 3.

### Step 2 — Promote the new private key

Update `.env` (or the production secret store) to point the active signing key at the new private key:

```env
JWT_PRIVATE_KEY_PATH=./keys/new-private.pem
JWT_PUBLIC_KEY_PATH=./keys/new-public.pem
JWT_ACTIVE_KID=key-2026-06
```

New tokens issued after this change will be signed with the new key and carry `kid: key-2026-06`.

### Step 3 — Retain the old public key for verification overlap

Add the **old** public key as the previous key so that tokens already issued with it continue to validate:

```env
JWT_PREVIOUS_PUBLIC_KEY_PATH=./keys/old-public.pem
JWT_PREVIOUS_KID=key-2026-05
```

The `PemKeyProvider` exports both keys in the JWKS response. Verification logic tries every key in the set until one succeeds.

### Step 4 — Deploy

Restart the service. The JWKS endpoint will now serve two public keys:

```bash
curl http://localhost:8080/.well-known/jwks.json | jq .
# { "keys": [ { "kid": "key-2026-06", ... }, { "kid": "key-2026-05", ... } ] }
```

Clients that cached the old JWKS will re-fetch within 5 minutes (max-age=300). During that window both keys are valid — no requests are rejected.

### Step 5 — Remove the old public key

Wait until **all old tokens have expired**. The maximum lifetime is controlled by `JWT_ACCESS_TOKEN_TTL_SECONDS` (default: 900 seconds / 15 minutes for access tokens) and `JWT_REFRESH_TOKEN_TTL_SECONDS` (default: 604800 seconds / 7 days for refresh tokens).

Once the oldest active refresh token has expired, remove the previous key:

```env
# Remove these two lines:
# JWT_PREVIOUS_PUBLIC_KEY_PATH=./keys/old-public.pem
# JWT_PREVIOUS_KID=key-2026-05
```

### Step 6 — Update JWT_ACTIVE_KID

Confirm `JWT_ACTIVE_KID` reflects the new key:

```env
JWT_ACTIVE_KID=key-2026-06
```

Restart the service. The JWKS endpoint will now serve only the new key.

---

## Production Key Generation

Generate a 2048-bit RSA keypair with openssl:

```bash
# Generate private key (PKCS8 format)
openssl genrsa -out private.pem 2048

# Extract public key (SPKI format)
openssl rsa -in private.pem -pubout -out public.pem
```

Store both files in a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) and inject them as `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` at runtime.

> **Security**: Never commit private key PEM files to version control. The `keys/` directory is git-ignored.

---

## Verifying the JWKS Endpoint

```bash
curl http://localhost:8080/.well-known/jwks.json | jq .
```

Expected output (single key):

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "key-2026-05",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

During rotation overlap you will see two objects in the `keys` array.

---

## Emergency Rotation

If a private key is **compromised**:

1. Follow the rotation procedure above immediately (Steps 1–4).
2. Force-revoke all active sessions by expiring every refresh token family:

```sql
UPDATE refresh_tokens
SET used_at = NOW()
WHERE used_at IS NULL;
```

This marks all refresh tokens as used, effectively logging out every active session. Users will need to log in again.

> Revoking refresh tokens does **not** immediately invalidate outstanding access tokens — those remain valid until their `exp` claim (at most `JWT_ACCESS_TOKEN_TTL_SECONDS` seconds, default 15 minutes). If immediate invalidation is required, rotate the public key in Step 5 ahead of schedule (removing the old public key before all old tokens have expired will reject them at verification time).
