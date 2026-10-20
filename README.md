# Ever After — Wedding Website Studio

A React and Node.js wedding invitation studio with owner accounts, published public invitations, guest lists, RSVP collection, media uploads, QR invitations, and a separate administrator view.

## Run locally

Requirements: Node.js 20 or later and npm.

1. Copy `.env.example` to `.env`.
2. On the first server start, a strong random `JWT_SECRET` is generated and stored privately in `data/.jwt-secret` if you have not configured one in `.env`.
3. Set `SUPERADMIN_EMAIL`, `SUPERADMIN_NAME`, and `SUPERADMIN_PASSWORD_HASH` to provision an administrator from the environment. Alternatively, create a temporary `.setup-admin.json` file in the project root containing a `name`, `email`, and `password`; the server hashes the password, creates the administrator, and deletes the one-time file on startup. That temporary file is Git-ignored. Generate an environment password hash interactively without putting the password in the command history:

   ```sh
   node --input-type=module -e "import bcrypt from 'bcryptjs'; import { createInterface } from 'node:readline/promises'; import { stdin, stdout } from 'node:process'; const terminal = createInterface({ input: stdin, output: stdout }); const password = await terminal.question('Admin password: '); terminal.close(); console.log(await bcrypt.hash(password, 12));"
   ```

   Store the resulting hash as `SUPERADMIN_PASSWORD_HASH`. Once the account has been created, do not change the hash in `.env` unless you want to set it up for a fresh database. Adding more accounts through public registration never grants administrator privileges.
4. Run `npm install`, then `npm run dev`.
5. Open `http://localhost:5173`.

The React development server proxies `/api` and `/uploads` to the Express API on port 4000. SQLite data and the generated local JWT secret are stored in `data/`; uploaded media is stored in `uploads/`. Both directories are ignored by Git. The local `.env` containing the admin password hash is also ignored by Git. Do not use the example values as production secrets.

For a production-style local run, set `CLIENT_ORIGIN` to the deployed frontend origin, run `npm run build`, then run `npm start`. Express serves the built frontend from `dist/`. Put the app behind HTTPS and configure a persistent disk or object storage for the SQLite database and uploaded media before deployment.

## Implemented workflows

- Email/password registration and sign-in with bcrypt password hashing, signed bearer sessions, input validation, and authentication rate limits.
- Owner-isolated wedding creation, editing, draft/publish status, customizable template selection, and public invitation pages.
- Per-guest invitation links with private RSVP tokens and party-size limits; guest status, check-in, CSV import, and CSV export.
- Authenticated image, video, and audio uploads with file-type and 25 MB limits.
- Downloadable QR codes for a published invitation, plus copy-link, WhatsApp, and email sharing links.
- Separate administrator navigation and server-authorized account status management.
- Responsive public invitation and dashboard layouts.

## API overview

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Create an account |
| `POST` | `/api/auth/login` | Public | Sign in |
| `GET` | `/api/auth/me` | Signed in | Current account |
| `GET`, `POST` | `/api/weddings` | Signed in | List or create wedding spaces |
| `PUT`, `DELETE` | `/api/weddings/:id` | Owner or admin | Update or remove a wedding |
| `GET` | `/api/preview/:slug` | Wedding owner | Privately preview an unpublished invitation |
| `GET`, `POST` | `/api/weddings/:id/guests` | Owner or admin | List or add guests |
| `PUT`, `DELETE` | `/api/weddings/:id/guests/:guestId` | Owner or admin | Update or remove a guest |
| `POST` | `/api/weddings/:id/guests/import` | Owner or admin | Import up to 1,000 guests |
| `GET` | `/api/weddings/:id/guests.csv` | Owner or admin | Download guest CSV |
| `POST`, `DELETE` | `/api/weddings/:id/media` | Owner or admin | Upload or remove wedding media |
| `GET` | `/api/public/:slug` | Public | Read a published invitation |
| `POST` | `/api/public/:slug/rsvp` | Public | Submit an RSVP using the guest's personal invitation token |
| `GET` | `/api/admin/users` | Admin | View accounts and wedding counts |
| `PATCH` | `/api/admin/users/:id/status` | Admin | Suspend or reactivate an account |

Protected routes require `Authorization: Bearer <token>`. Drafts are visible through the authenticated private preview route, while the public invitation endpoint only returns published weddings. The guest list returns invitation tokens only to the authorized wedding owner; use the guest-row share action to copy a personal RSVP link. The public RSVP endpoint requires that token, confirms the invited name, and enforces the invited party size. The SQLite schema and indexes are initialized automatically on server start.

## Production considerations

This is a working application foundation, not a substitute for a deployment security review. Configure strong secrets, HTTPS, backups, persistent storage, and monitored logs. Before using it for live events, add email verification and password reset delivery, RSVP deadline controls, account deletion/retention workflows, audit logging, storage quotas, and a production object-storage adapter. Billing, multilingual dashboard copy, and camera-based QR check-in are not included. The email share button opens the visitor's email application; it does not claim to send provider-backed mail.
