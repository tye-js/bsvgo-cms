# BSVgo CMS

Independent admin system for managing BSVgo blog content. It is a Next.js App Router project that writes to PostgreSQL through Drizzle and stays decoupled from the public blog frontend.

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS
- PostgreSQL with Drizzle schema and migrations
- Database-backed sessions with httpOnly cookies
- Argon2id password hashing

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.

3. Run the compatibility migration against the PostgreSQL database in `.env`:

```bash
npm run db:migrate
```

This project is designed to attach to the existing BSVgo database. The migration only adds admin-required columns and tables when missing; it does not rebuild the public blog schema.

4. Seed the initial admin and fixed categories:

```bash
npm run db:seed
```

5. Start development:

```bash
npm run dev
```

Open `http://localhost:3100/login` and sign in with the seeded admin account. Then open Settings and save the OpenAI API key/model used for English generation.

## Commands

```bash
npm run dev        # start local Next.js dev server
npm run build      # production build
npm run start      # start production server
npm run typecheck  # TypeScript check
npm run db:migrate
npm run db:seed
npm run admin:verify
npm run db:studio
```

## Data Model

Core tables:

- `users`: admin/editor accounts with Argon2id password hashes
- `sessions`: hashed session tokens and expiration
- `posts`: article metadata, status, slug, SEO, publishing, ordering, featured and pinned flags
- `post_translations`: English and optional Chinese title, excerpt, body
- `media_assets`: managed image URLs used for required post covers
- `app_settings`: database-backed operational settings such as encrypted AI API key
- `categories`: fixed primary categories
- `category_translations`: English and Chinese category copy
- `tags`: tag metadata and SEO
- `tag_translations`: English and optional Chinese tag copy
- `post_tags`: many-to-many post/tag bindings

English remains the primary language for the public blog, while new CMS posts are created from a Chinese source draft. The CMS generates the linked English translation with the configured OpenAI Codex model and stores both languages on the same `posts` record.

For the existing BSVgo schema, article SEO fields and reading minutes live on `post_translations`, while post-level publishing fields live on `posts`. Cover image URLs are still mirrored to `posts.cover_image` for frontend compatibility and are also linked to `media_assets`.

## Security Notes

- Admin routes are protected by server-side `requireUser()`.
- Passwords are never stored in plain text.
- Sessions are stored in PostgreSQL and exposed only through httpOnly cookies.
- Server actions validate form input with Zod.
- Drizzle query builders are used for database access.
- Delete actions require browser confirmation and soft-delete content where appropriate.
- Sensitive environment variables are read only on the server.
- AI API keys are configured in Settings, encrypted with server-side key material, and never displayed in full.

## VPS Deployment

This project deploys without Docker. The app can run as a standalone Node process or under PM2.

Install prerequisites on the VPS:

```bash
# Node.js 22+ is recommended for this project. Node.js 24 is supported.
npm install -g pm2
```

For GitHub Actions deployment, the server does not need an existing `bsvgo-cms` directory. The workflow creates `APP_DIR`, clones the repository, and writes `.env` during the first deployment.

If deploying manually, clone the repository and create the production `.env` directly on the VPS:

```bash
git clone https://github.com/YOUR_ORG/YOUR_REPO.git /var/www/bsvgo-cms
cd /var/www/bsvgo-cms
npm ci
cp .env.example .env
```

Edit `.env` with the real PostgreSQL connection and secrets.

For production uploads, keep files outside the git checkout and use an absolute public media URL so saved image records include the domain prefix:

```bash
UPLOAD_DIR=/var/www/bsvgo-cms-uploads
MEDIA_PUBLIC_BASE_URL=https://cms.bsvgo.com/uploads
MAX_UPLOAD_SIZE_MB=5
```

Manual deploy flow:

```bash
git pull --ff-only origin main
npm ci
npm run db:migrate
npm run build
PORT=3100 HOSTNAME=0.0.0.0 pm2 reload bsvgo-cms --update-env || PORT=3100 HOSTNAME=0.0.0.0 pm2 start npm --name bsvgo-cms -- start
pm2 save
```

### GitHub Actions Deployment

GitHub Actions deployment is included in `.github/workflows/deploy.yml`. It builds the app in GitHub Actions, then connects to the VPS by SSH and runs:

```bash
mkdir -p APP_DIR parent directory
git clone on first deploy, otherwise:
git fetch using the workflow GITHUB_TOKEN
git pull --ff-only
create .env on first deploy
npm ci
npm run db:migrate
npm run build
PORT=3100 HOSTNAME=0.0.0.0 pm2 reload bsvgo-cms --update-env || PORT=3100 HOSTNAME=0.0.0.0 pm2 start npm --name bsvgo-cms -- start
pm2 save
```

Configure these GitHub repository secrets:

- `SERVER_IP`
- `SERVER_USER`
- `SSH_PRIVATE_KEY`: private key used by Actions to SSH into the VPS
- `VPS_PORT`: optional, defaults to `22`
- `VPS_SSH_FINGERPRINT`: optional but recommended host key fingerprint for SSH verification
- `APP_DIR`: absolute path to the checked-out app on the VPS, for example `/var/www/bsvgo-cms`
- `DATABASE_URL`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`
- `NEXT_PUBLIC_SITE_URL`: optional

Optional GitHub repository variables:

- `APP_BRANCH`: branch to deploy, defaults to `main`
- `PM2_APP_NAME`: PM2 process name, defaults to `bsvgo-cms`
- `APP_PORT`: app port, defaults to `3100`
- `UPLOAD_DIR`: persistent upload directory on the VPS, for example `/var/www/bsvgo-cms-uploads`
- `MEDIA_PUBLIC_BASE_URL`: public upload URL, for example `https://cms.bsvgo.com/uploads`
- `MAX_UPLOAD_SIZE_MB`: upload size limit in MB, defaults to `5`

AI generation is configured inside the CMS Settings page after deployment, not in GitHub Secrets.

The workflow temporarily switches the VPS repository remote to an HTTPS URL with the workflow `GITHUB_TOKEN`, pulls the target branch, then restores the remote to plain HTTPS. The VPS does not need a GitHub SSH deploy key for normal deployments.

The SSH user needs permission to read and write `APP_DIR`, install npm dependencies, run migrations against the database in `.env`, and manage the PM2 process.

Recommended first-time server setup before running Actions:

```bash
sudo mkdir -p /var/www/bsvgo-cms
sudo chown -R "$USER":"$USER" /var/www/bsvgo-cms
```

After that, pushes to `main` or manual `workflow_dispatch` runs will initialize and deploy automatically.

If the VPS currently has an SSH remote and deploy fails with `git@github.com: Permission denied (publickey)`, change it once:

```bash
cd /var/www/bsvgo-cms
git remote set-url origin https://github.com/YOUR_ORG/YOUR_REPO.git
```

## AI Settings

Open Settings as an admin and configure:

- OpenAI API key
- Model, default `gpt-5.3-codex`
- Timeout, default `60000` ms

The API key is stored encrypted in PostgreSQL. Leaving the key field blank keeps the existing key.

## Media

Post cover images are optional. When a post has no cover, the CMS displays `/images/post-cover-placeholder.svg` and saves `posts.cover_image` as an empty string. Uploaded or selected covers are stored in `media_assets`, linked through `posts.cover_image_id`, and mirrored to `posts.cover_image` for the existing frontend.

Uploads accept JPEG, PNG, WebP, and AVIF. Development defaults to `public/uploads`; production should use a persistent directory and Nginx alias:

```nginx
location /uploads/ {
    alias /var/www/bsvgo-cms-uploads/;
    access_log off;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000";
}
```
