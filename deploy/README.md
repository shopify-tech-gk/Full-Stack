# Deploying YouMart to AWS (EC2, Mumbai)

One server runs everything with Docker Compose: Caddy (HTTPS), the Next.js website, the API
gateway + 15 services, PostgreSQL, Redis and Typesense. Cloudflare sits in front (DNS, SSL,
caching, DDoS); product images are served from Cloudflare R2. Starting size: **m7g.large**
(2 vCPU, 8 GB, Graviton) - or **m7i.large** (Intel) if the ARM test in step 1 fails.

```
visitor -> Cloudflare -> EC2 :443 Caddy -> /api/* -> gateway -> services -> Postgres / Redis / Typesense
                                        -> /*     -> web (Next.js)
images  -> Cloudflare R2 (img.youmart.in)
```

Files in this folder:

| File | What it is |
|---|---|
| `backend.Dockerfile` | One image for the gateway, all 15 services and the migrations |
| `web.Dockerfile` | The website (Next.js standalone build) |
| `docker-compose.prod.yml` | The whole stack on the server |
| `Caddyfile` | HTTPS + routing (`/api` -> gateway, the rest -> website) |
| `.env.production.example` | Every setting for production; secrets are `CHANGE_ME` |
| `server/bootstrap.sh` | One-time server setup (Docker, swap, AWS CLI, backup cron) |
| `server/deploy.sh` | Pull images, migrate, set DB passwords, restart, health check |
| `server/set-db-passwords.sh` | Replaces the development DB passwords the migrations create |
| `server/backup.sh` | Nightly `pg_dump` to S3 |
| `../.github/workflows/deploy.yml` | Build ARM/Intel images and deploy via Session Manager |
| `../scripts/switch-image-domain.mjs` | Move image links from `r2.dev` to the custom domain |

All prices are approximate (Mumbai, ap-south-1) and AWS India adds 18% GST.

---

## 1. One-hour ARM test (about ₹10) - before choosing the server type

Search uses Typesense's built-in embedding model (`ts/all-MiniLM-L12-v2`). Confirm it runs on
Graviton before committing to ARM.

1. EC2 -> Launch instance: **Ubuntu Server 24.04 LTS (64-bit Arm)**, type **m7g.large**, any key /
   security group, 20 GB disk. Connect with **EC2 Instance Connect** (browser).
2. Run:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo docker run -d --name ts -p 8108:8108 typesense/typesense:30.2 --data-dir=/tmp --api-key=test
   sleep 15
   H='X-TYPESENSE-API-KEY: test'
   curl -s -H "$H" -X POST localhost:8108/collections -d '{"name":"p","fields":[{"name":"title","type":"string"},{"name":"embedding","type":"float[]","embed":{"from":["title"],"model_config":{"model_name":"ts/all-MiniLM-L12-v2"}}}]}'
   curl -s -H "$H" -X POST 'localhost:8108/collections/p/documents/import' -d $'{"title":"Samsung Galaxy smartphone 128GB"}\n{"title":"Organic vermicompost 5 kg"}'
   curl -s -H "$H" 'localhost:8108/collections/p/documents/search?q=mobile%20phone&query_by=title,embedding&exclude_fields=embedding' | head -c 600
   ```
3. **Pass:** the collection is created (the model downloads on first use, ~1 min) and searching
   "mobile phone" returns the Samsung phone although the word "mobile" isn't in its title.
   **Fail:** an error creating the collection / no semantic match -> use **m7i.large** and set the
   GitHub variables `TARGET_PLATFORM=linux/amd64`, `BUILD_RUNNER=ubuntu-latest` (step 9).
4. **Terminate the test instance.**

## 2. IAM role for the server

IAM -> Roles -> Create role -> AWS service -> EC2. Attach:
- `AmazonSSMManagedInstanceCore` (Session Manager - no SSH port needed)
- `CloudWatchAgentServerPolicy` (memory / disk metrics)
- an inline policy for backups and email:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      { "Effect": "Allow", "Action": ["s3:PutObject"], "Resource": "arn:aws:s3:::YOUR-BUCKET/postgres/*" },
      { "Effect": "Allow", "Action": ["ses:SendEmail", "ses:SendRawEmail"], "Resource": "*" }
    ]
  }
  ```
Name it `youmart-server`.

## 3. S3 bucket for database backups

S3 -> Create bucket (ap-south-1), e.g. `youmart-backups-<something-unique>`, block all public access,
default encryption on. Management -> Lifecycle rule for prefix `postgres/`: move to Glacier Instant
Retrieval after 30 days, delete after 180 days.

## 4. Launch the server

EC2 -> Launch instance:
- **Ubuntu Server 24.04 LTS** (Arm for m7g / x86 for m7i), type **m7g.large** (or m7i.large)
- Storage: **100 GB gp3**, encrypted
- IAM instance profile: `youmart-server`
- Key pair: **none** (Session Manager is used instead)
- Security group `youmart-web`: inbound **443 and 80 from Cloudflare's IP ranges only**
  (https://www.cloudflare.com/ips/ - add each IPv4 and IPv6 range). **No port 22.**

Then: Elastic IPs -> Allocate -> Associate with the instance. Connect: EC2 -> instance ->
Connect -> **Session Manager**.

Backups of the disk: AWS Backup -> Create backup plan -> daily, keep 7 days -> assign the instance.

## 5. Cloudflare

1. Add the site (free plan), change the domain's nameservers to Cloudflare's.
2. DNS: `A  youmart.in -> <Elastic IP>` (proxied, orange cloud), `CNAME www -> youmart.in` (proxied).
3. SSL/TLS -> mode **Full (strict)**; Edge Certificates -> Always Use HTTPS on.
4. SSL/TLS -> Origin Server -> **Create certificate** (RSA, hostnames `youmart.in, *.youmart.in`,
   15 years). Keep the certificate and private key for step 6.
5. **R2 images**: R2 -> your bucket -> Settings -> Custom Domains -> connect `img.youmart.in`.
   (The `pub-...r2.dev` address is rate-limited and not for production; step 11 moves the links.)

## 6. Server setup (Session Manager shell)

```bash
sudo -i
# get the deploy files (fine-grained GitHub token with read-only "Contents" on the repo)
git clone --depth 1 https://<TOKEN>@github.com/shopify-tech-gk/Full-Stack.git /tmp/ym
bash /tmp/ym/deploy/server/bootstrap.sh
cp /tmp/ym/deploy/docker-compose.prod.yml /tmp/ym/deploy/Caddyfile /opt/youmart/
cp -r /tmp/ym/deploy/server /opt/youmart/ && chmod +x /opt/youmart/server/*.sh
cp /tmp/ym/deploy/.env.production.example /opt/youmart/.env
rm -rf /tmp/ym
# Cloudflare origin certificate from step 5.4
nano /opt/youmart/certs/origin.pem   # paste the certificate
nano /opt/youmart/certs/origin.key   # paste the private key
chown -R ubuntu:ubuntu /opt/youmart && chmod 600 /opt/youmart/.env /opt/youmart/certs/*
```

## 7. Fill in `/opt/youmart/.env`

`nano /opt/youmart/.env` and replace every `CHANGE_ME` / `changeme_...`:
- **Passwords** (Postgres + every `*_DATABASE_URL`, Typesense key, OTP / bank hash secrets): letters
  and digits only - generate each with `openssl rand -hex 24`.
- **JWT keys**: a NEW pair for production (command in the file's JWT comment, run with `node`).
- **Razorpay LIVE** keys + webhook secret; MSG91, Zoho, Anthropic keys; business GST details.
- `BACKEND_IMAGE` / `WEB_IMAGE`: `ghcr.io/<github-owner-lowercase>/youmart-backend` / `-web`.
- `BACKUP_S3_URI=s3://<bucket from step 3>/postgres`, `SITE_DOMAIN=youmart.in`.
- Keep `RATE_LIMIT_MAX=300` (never copy the local `.env`, which is raised for imports).

## 8. Let the server pull images

GitHub -> Settings -> Developer settings -> fine-grained token with **read:packages** only. Then:
```bash
sudo -u ubuntu docker login ghcr.io -u <github-username>   # paste the token as the password
```

## 9. GitHub -> AWS (no stored keys)

1. IAM -> Identity providers -> Add -> OpenID Connect: `https://token.actions.githubusercontent.com`,
   audience `sts.amazonaws.com`.
2. IAM role `youmart-github-deploy`, trusted by that provider, condition
   `token.actions.githubusercontent.com:sub` = `repo:shopify-tech-gk/Full-Stack:environment:production`.
   Permissions: `ssm:SendCommand` on the instance + `AWS-RunShellScript` document, and
   `ssm:GetCommandInvocation`.
3. Repo -> Settings -> Environments -> `production` (add yourself as required reviewer if wanted).
   Secrets: `AWS_DEPLOY_ROLE_ARN`. Variables: `EC2_INSTANCE_ID`, `SITE_URL=https://youmart.in`,
   `AWS_REGION=ap-south-1` (+ `TARGET_PLATFORM` / `BUILD_RUNNER` only for Intel).

## 10. Bring the data over (once)

The catalog (127,921 products, reviews, settings) lives in the local database. On your PC:
```powershell
docker exec docker-postgres-1 pg_dump -U youmart_dev -d youmart_dev --format=custom --no-owner -f /tmp/youmart.dump
docker cp docker-postgres-1:/tmp/youmart.dump .\youmart.dump
```
Upload it to the backup bucket (S3 console, `restore/youmart.dump`), then on the server:
```bash
cd /opt/youmart
aws s3 cp s3://<bucket>/restore/youmart.dump backups/youmart.dump
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres
docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres \
  pg_restore -U youmart -d youmart --no-owner --role=youmart < backups/youmart.dump
```
Remove test data afterwards (test orders, demo coupons, test users) as needed.

## 11. First deploy

GitHub -> Actions -> **Deploy to production** -> Run workflow. It builds both images (~15-25 min the
first time, cached after) and runs `server/deploy.sh`: migrations, per-service DB passwords,
start, health check. Then, on the server:
```bash
cd /opt/youmart
# image links -> custom domain (dry run first), then the search index rebuilds itself
docker compose -f docker-compose.prod.yml --env-file .env run --rm -e GATEWAY_URL=http://gateway:4000 \
  gateway node scripts/switch-image-domain.mjs https://img.youmart.in --dry-run
docker compose -f docker-compose.prod.yml --env-file .env run --rm -e GATEWAY_URL=http://gateway:4000 \
  gateway node scripts/switch-image-domain.mjs https://img.youmart.in
```
Open https://youmart.in, search, place a small real order and refund it.

## 12. Go-live checklist

- Razorpay dashboard -> webhook URL `https://youmart.in/api/payments/webhook` (LIVE mode).
- Phone app: `EXPO_PUBLIC_API_URL=https://youmart.in/api` for the store build.
- CloudWatch agent (memory + disk): `sudo snap install amazon-cloudwatch-agent` or the
  `AmazonCloudWatch-ManageAgent` SSM document; alarms at memory > 85 %, disk > 80 %.
- UptimeRobot (free): `https://youmart.in/api/catalog/categories` every 5 min.
- After 2-4 weeks on-demand: buy a **1-year Compute Savings Plan** for the size you settled on.
- Grow: memory or search tight (at ~5 lakh products, reindex needs ~7 GB) -> stop, change type to
  **m7g.xlarge (16 GB)**, start.

## Everyday

```bash
cd /opt/youmart
docker compose -f docker-compose.prod.yml --env-file .env ps          # what is running
docker compose -f docker-compose.prod.yml --env-file .env logs -f order # one service's log
/opt/youmart/server/backup.sh                                          # backup now
```
Deploy a new version: GitHub Actions -> Deploy to production -> Run workflow.
