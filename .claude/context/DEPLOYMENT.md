# DEPLOYMENT.md — Corehub on the shared Hostinger VPS

> Read this before touching anything under `docker/`, `.github/workflows/`, or
> `scripts/deploy-vps.sh`.

## The constraint that shapes everything

The VPS also runs **seven production systems for paying clients**, under
`guay.pro`, on PM2 behind a single nginx with certbot:

```
gestion · panel · recuerdos · dashboard-{usil,taxit,tiomono,kitadol}
```

Every design decision below exists to keep those seven untouched. When in
doubt, the rule is: **we adapt to what is already there; it does not adapt to
us.**

---

## Topology

One VPS, two environments, separated by port, docker network, database and
nginx vhost.

| Service | DEV domain | Port | PROD domain | Port |
|---|---|---|---|---|
| hub | `dev.corehub.guay.pro` | 4111 | `corehub.guay.pro` | 4101 |
| api-iam | `dev.api.corehub.guay.pro` | 4112 | `api.corehub.guay.pro` | 4102 |
| instagram-web | `dev.ig.corehub.guay.pro` | 4113 | `ig.corehub.guay.pro` | 4103 |
| instagram-api | `dev.iga.corehub.guay.pro` | 4114 | `iga.corehub.guay.pro` | 4104 |

**Everything binds to `127.0.0.1`, never `0.0.0.0`.** Only nginx reaches the
containers. On a box with seven other systems, an open port is surface nobody
asked for.

**The 30xx range is taken** by the neighbours (3001, 3002, 3004, 3005, 3010,
3020, 3100). Do not use it. Corehub owns 41xx.

**Postgres publishes no port at all.** Containers talk over the compose
network; use `docker compose exec postgres psql` to get in. A port that does
not exist cannot collide and cannot be attacked.

**The `dev.` prefix goes first** (`dev.api.corehub`, not `api.dev.corehub`).
That is what lets one workflow and one compose file serve both environments —
the difference is an empty string or `dev.`.

---

## nginx: two traps

**1. The filename decides the default server.**

No vhost on this box declares `default_server`. When none does, nginx makes the
**first server block for that port** the catch-all, and `sites-enabled` is
included alphabetically. Today that is `guay-gestion`, so `gestion.guay.pro`
answers for unknown hosts.

Our file is called **`zz-corehub-dev`** for exactly this reason. A file named
`corehub` sorts before `guay-gestion` and would silently steal the catch-all
from a client system — without a single error, and without touching their
config.

**2. The agent's timeout is not the default.**

`/api/chat` does **not** stream. It is one blocking request with
`REQUEST_BUDGET_MS = 180_000`, and measured generations take 28–59 s. The
neighbours' vhosts use `proxy_read_timeout 60s`; copying that gives you a 504
on requests that are working correctly — a proxy failure wearing the app's
clothes. The `iga.` vhost uses **200s**, above the app's own budget, so
whichever side cuts is the side that knows why.

**House runbook for adding a vhost** (documented in `panel-general`):

1. DNS A record → VPS IP
2. Write the vhost with `listen 80` **only** — a 443 block without a
   certificate makes `nginx -t` fail
3. `ln -s` into `sites-enabled`
4. `nginx -t && systemctl reload nginx` — chained, so a broken config never
   loads
5. `certbot --nginx -d ...` — certbot adds the 443 block and the redirect

Always `reload`, never `restart`. Reload lets existing connections finish;
restart cuts them, and most of them belong to the neighbours.

---

## The pipeline

```
push to develop
  → verify   ci.yml via workflow_call: type-check, lint, tests
  → build    4 images, linux/amd64, → ghcr.io/<repo>/<app>:dev-<sha>
  → deploy   ssh → compose over stdin → pull → up -d → smoke tests
```

`main` builds `prod-<sha>` but **does not deploy**. Production is manual
approval, on purpose.

**Images are built on GitHub runners, never on the VPS.** Two reasons: the box
has no CPU to spare, and an image built on an Apple Silicon Mac is arm64 and
dies with `exec format error` there.

**`NEXT_PUBLIC_*` are baked at build time.** The two Next apps therefore carry
their environment inside the image — dev and prod are separate builds, not a
promoted artifact. The two APIs read config at runtime and could be promoted.

---

## The deploy, and why it looks like that

`scripts/deploy-vps.sh` lives at `/opt/corehub/deploy-vps.sh`. The GitHub key is
bound to it in `authorized_keys`:

```
command="/opt/corehub/deploy-vps.sh",no-port-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA...
```

That key cannot open a shell, forward a port, or run `scp`. If the GitHub secret
leaks, the worst it buys is a deploy of this application — not a shell on a
machine serving seven clients.

**Because a restricted key rules out `scp`**, the `compose.yml` travels on the
same connection's **stdin**, and the image tag arrives as `SSH_ORIGINAL_COMMAND`.
The tag is still validated against `^(dev|prod)-[0-9a-f]{40}$`: it reaches a
`sed` and a `docker pull`, and an unchecked argument is where that restriction
would leak.

The script **validates the incoming compose before replacing the running one**
and restores `compose.yml.prev` if it does not parse. A broken compose that
already overwrote the good one leaves a stack with no way back up, on a machine
you reach over SSH.

**Deploys pin the exact sha, never `dev-latest`.** A moving tag makes two
deploys of one commit different. Rollback is running the script with the
previous sha.

### Smoke tests judge us and the neighbours differently

Ours must answer 2xx/3xx. `instagram-api`'s `/health/ready` touches the database
**and** IAM, so a 200 there proves the containers reach each other.

For the seven neighbours, only **silence or 502/503/504** fails the deploy —
that is what breaking the shared nginx looks like. A 500 of their own is not
ours, and must not turn our pipeline red.

---

## Configuration: what lives where

| Lives in the repo | Lives only on the server |
|---|---|
| `docker/compose.vps.yml` | `.env` (ports, tag, password, domains) |
| `docker/vps/*.example` | `env/api-iam.env`, `env/instagram-api.env` |
| `docker/vps/postgres-init/` | `keys/private.pem`, `keys/public.pem` |
| | `media/carousels/` |

The deploy syncs **only `compose.yml`**. Secrets and keys are never touched by
CI. Adding a variable is a manual step on the server.

```
/opt/corehub/dev/
  compose.yml          .env
  env/                 api-iam.env  instagram-api.env      (chmod 600)
  keys/                private.pem (600)  public.pem (644) (owner uid 1001)
  media/carousels/     generated images, mounted as a volume (uid 1001)
  postgres-init/       01-create-databases.sql
```

`uid 1001` is the container user. It is also `deploy` on the host, which is why
the ownership lines up.

### Things that are not optional

**JWT keys are generated once per environment and mounted.** RS256, PKCS8
private, SPKI public. If the image regenerated them, every release would
invalidate every session and every token already issued.

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -in private.pem -pubout -out public.pem
chown 1001:1001 *.pem && chmod 600 private.pem && chmod 644 public.pem
```

**Generated carousels need a volume.** The agent writes them to disk and the API
serves them at `/carousels/*`. Without the mount, every deploy deletes them all.

**Docker log rotation is capped** (10 MB × 3 per service). The default driver
grows without limit; on this box a runaway log fills the disk and takes the
seven client systems with it.

---

## The variables that were production bugs

Each of these had a development default that produced a deployment which
started cleanly, passed every health check, and failed later.

| Variable | Where | What it broke |
|---|---|---|
| `COOKIE_DOMAIN` | api-iam | `hub_session` stayed on the API's host; login succeeded and the hub bounced to /login forever |
| `INSTAGRAM_DASHBOARD_WEB_URL` | api-iam (seed) | Product `defaultUrl` written to the **database** as `localhost:3010`; the hub opened the user's own machine |
| `POST_AUTH_REDIRECT_URL` | instagram-api | Instagram OAuth returned the browser to `localhost:3001` |
| `SMTP_USER` / `SMTP_PASSWORD` | api-iam | The adapter could not authenticate at all — it was built for MailDev |
| `DOMAIN_HUB` / `DOMAIN_IG_WEB` / `DOMAIN_IG_API` | compose | Feed the three above |
| `OPERATOR_EMAIL` + `SMTP_*` | instagram-api | Without them the connection wizard's queue still works, but nobody is told a request arrived |

`instagram-api`'s config now **refuses to start** in production when any
browser-reachable URL still points at localhost or 127.0.0.1. Parsing happens at
import, so a misconfigured container never serves traffic. Extend that guard
rather than adding another silent default.

**`EMAIL_PROVIDER` and `OTP_EMAIL_PROVIDER` are two variables.** Setting only the
first leaves login codes going to the stub adapter: mail "works" and nobody can
sign in.

---

## Operations

**Deploy** — automatic on push to `develop`. By hand:

```bash
cd /opt/corehub/dev && docker compose pull && docker compose up -d && docker compose ps
```

**Rollback** — re-run the deploy script with the previous sha.

**Seed** — not automatic, and `index.ts` does not call it. The superadmin comes
from here, and it is an upsert, so re-running updates the password from the env
file:

```bash
docker compose run --rm api-iam node_modules/.bin/tsx src/db/seed.ts
```

`seedDevFixtures` and `seedWorkingFixtures` are gated on
`NODE_ENV === 'development'` and are skipped in the containers.

**Logs** — `docker compose logs <service> --no-log-prefix --tail 40`. api-iam
emits structured JSON (pino), so `| jq` works. There is no aggregation: logs
live in the container and go away when it is replaced.

**Verify the neighbours** — after anything that touches nginx or Docker:

```bash
for d in gestion panel recuerdos dashboard-usil dashboard-taxit dashboard-tiomono dashboard-kitadol; do
  printf '%-30s %s\n' "$d.guay.pro" "$(curl -s -o /dev/null -w '%{http_code}' https://$d.guay.pro --max-time 10)"
done
```

Baseline: `gestion` answers **302**, the other six answer **200**. That 302 is
correct — do not "fix" it.

---

## Bringing up production

The path is already walked; this is repetition, not discovery.

1. Four A records: `corehub`, `api.corehub`, `ig.corehub`, `iga.corehub`
2. `/opt/corehub/prod/` with the same layout and **its own JWT key pair**
3. `.env` with `ENV_NAME=prod`, ports 410x, domains without the `dev.` prefix
4. vhost `zz-corehub-prod` (port 80 only) → `nginx -t && reload` → certbot
5. `docker login ghcr.io` as `deploy` (already done for dev)
6. Remove `if: github.ref_name == 'develop'` from the deploy job and gate it
   behind a GitHub Environment with required reviewers

**Production JWT keys are never the dev ones**, and the superadmin password is
different.

---

## Known debt

- **No log aggregation.** Rotation only. Fine for dev; decide before production
  matters.
- **The API images weigh ~700 MB** because the runner copies the whole
  workspace: the Prisma client lives in `node_modules` and `migrate deploy`
  needs `prisma/`. Trim it with measurement, not by intuition.
- **`ufw` is inactive** and the neighbours' PM2 apps listen on `0.0.0.0`. Not
  ours to change, and enabling a firewall carelessly locks everyone out of SSH.
  Belongs to whoever owns those seven systems.
- **A pending kernel reboot and PM2 running against an upgraded libssl.**
  Pre-existing, coordinated by the owner of the client systems, not by us.
