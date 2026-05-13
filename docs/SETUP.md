# Project Setup Guide

This guide walks through the full setup process for a fresh clone of the repository.

## 1. Prerequisites

Before cloning or starting the app, make sure you have:

- Node.js 20 or newer.
- `pnpm` installed and available in your shell.
- A running PostgreSQL instance.
- Access to the required environment values for database, authentication, and external services.

If you use Corepack, you can enable pnpm with:

```bash
corepack enable
```

## 2. Clone the Repository

```bash
git clone <repository-url>
cd build-it
```

Replace `<repository-url>` with the actual Git remote for your team or project.

## 3. Install Dependencies

Install the package dependencies from the repository root:

```bash
pnpm install
```

The project is configured for pnpm, so use pnpm for all install and script commands unless your team has a different standard.

## 4. Create the Environment File

Create a file named `.env` in the repository root.

The application reads the following variables during startup:

- `DB_HOST` - PostgreSQL host name or IP address.
- `DB_USER` - PostgreSQL username.
- `DB_PASSWORD` - PostgreSQL password.
- `DB_NAME` - PostgreSQL database name.
- `DB_PORT` - PostgreSQL port, usually `5432`.
- `DB_SSL` - set to `true` when the database requires SSL.
- `BETTER_AUTH_URL` - base URL for the authentication service, for example `http://localhost:3000` during local development.

Optional variables used by admin or execution features:

- `JET_SERVER_URL` - base URL of the Jet execution engine. Defaults to `http://localhost:4000` when omitted.
- `JET_HMAC_SECRET` - HMAC secret used to sign Jet requests.
- `JET_HMAC_KEY_ID` - HMAC key identifier used for Jet requests.
- `GROQ_API_KEY` - required only for AI-assisted problem generation flows.

Example .env file:

```bash
DB_HOST=127.0.0.1
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=build_it
DB_PORT=5432
DB_SSL=false
BETTER_AUTH_URL=http://localhost:3000
JET_SERVER_URL=http://localhost:4000
JET_HMAC_SECRET=your-secret
JET_HMAC_KEY_ID=your-key-id
GROQ_API_KEY=your-api-key
```

## 5. Prepare PostgreSQL

Make sure the target database exists before starting the app.

If you are working locally, create the database with the name you placed in `DB_NAME`, then confirm the connection details in `.env`.

## 6. Apply the Database Schema

For a fresh clone, the quickest way to align the schema is:

```bash
pnpm db:push
```

This pushes the current Drizzle schema to PostgreSQL.

If you are changing schema files and want to generate migrations first, use:

```bash
pnpm db:generate
```

## 7. Seed Initial Data

The app does not use public self-registration for normal use, so most environments need at least one user account created by an admin or maintainer.

To create a user, run the user bootstrap script:

```bash
pnpm tsx scripts/users/create-user.ts
```

The script prompts for role, username, name, gender, email, branch, semester, section, date of birth, regulation, and password.

If your environment has a prepared question import file, you can seed question collections with:

```bash
pnpm tsx scripts/seed-questions.ts <file-path> <collection-title>
```

The import file must be a JSON array of question objects.

## 8. Start the Development Server

Run the app locally with:

```bash
pnpm dev
```

Then open:

```text
http://localhost:3000
```

## 9. Verify the Setup

After the app starts, confirm the following:

- The homepage loads without database or auth errors.
- Sign-in works with the user you created.
- Pages that depend on PostgreSQL can read and write data.
- If Jet integration is enabled, execution-related routes can contact the configured engine.

You can also run the standard checks:

```bash
pnpm lint
pnpm build
```

## 10. Common First-Run Issues

- If the app fails on startup with database errors, double-check every `DB_*` value in `.env`.
- If auth pages fail to initialize, confirm `BETTER_AUTH_URL` matches the URL you are using in the browser.
- If code execution features fail, verify `JET_SERVER_URL`, `JET_HMAC_SECRET`, and `JET_HMAC_KEY_ID`.
- If AI-assisted problem generation fails, verify `GROQ_API_KEY` is set.

## 11. Day-to-Day Commands

- `pnpm dev` - development server.
- `pnpm build` - production build.
- `pnpm start` - start production server.
- `pnpm lint` - lint and static checks.
- `pnpm format` - format source files.
- `pnpm db:generate` - generate Drizzle migrations.
- `pnpm db:push` - push schema changes to PostgreSQL.
- `pnpm test:jet-hmac-v2` - test Jet signing configuration.

## 12. What To Do Next

Once the app is running, the usual next step is to create or import users and question data, then verify the exam and execution flows in the browser.