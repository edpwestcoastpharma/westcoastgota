# West-Coast Gota Plant – Tool Access

Login portal for the Gota plant. Admins add tools, create user IDs and passwords,
and choose which tools each user sees. Users sign in and open their tools.

## Files
- `index.html` – the page
- `assets/styles.css`, `assets/app.js`, `assets/logo.webp`, `assets/favicon.svg`
- `config.js` – choose local or Supabase storage
- `supabase-setup.sql` – one-time database setup for shared mode
- `vercel.json` – Vercel settings (ignored by other hosts)

## Starting logins (change after first sign-in)
| Account | User ID | Password |
|---|---|---|
| Admin | admin.gota | WCGota@2026 |
| User (BMR, PV, CDP) | bhargavi.patel | Bhargavi@2026 |

## Hosting
Any static host works: Vercel, Netlify, Hostinger / cPanel (upload to `public_html`), GitHub Pages.
The site must open over **https** (password checking uses the browser's secure crypto).

**Vercel:** unzip → drag the folder onto vercel.com/new, or run `vercel --prod` inside the folder.
**Hostinger / cPanel:** File Manager → `public_html` → upload the ZIP → Extract.

## Storage modes
1. **local (default)** – works immediately. Each browser keeps its own users and tools,
   so a user added on the admin's PC won't exist on another PC. Good for testing.
2. **supabase (recommended for the plant)** – shared on every computer:
   1. Create a free project at supabase.com
   2. SQL Editor → paste `supabase-setup.sql` → Run
   3. Project Settings → API → copy Project URL and anon public key
   4. In `config.js` set `storage: "supabase"` and paste both values, then redeploy

## Backup
Plant settings → Download backup saves all users, tools and settings as JSON.
Restore backup loads it back (useful to move from local to Supabase mode).

## Security note
IDs and passwords are an access gate for internal staff. Passwords are stored as salted
SHA-256 hashes, but checking happens in the browser, so this is not bank-grade security.
Keep confidential data inside the tools themselves, which should have their own protection.
