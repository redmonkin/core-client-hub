# Self-hosting Clientra

This guide takes you from nothing to your own running copy of Clientra. It takes about an hour, most of it waiting for DNS.

You'll set up three things:

1. **Supabase**: the database, sign-in, file storage, server functions and scheduled jobs.
2. **Resend**: sends email (proposals, invoices, reminders, sign-up confirmations and password resets).
3. **A static host** for the website. This guide uses Vercel; any static host works.

## Contents

- [What you need](#what-you-need)
- [Part 1: Supabase](#part-1-supabase)
- [Part 2: Resend (email)](#part-2-resend-email)
- [Part 3: Deploy the server functions](#part-3-deploy-the-server-functions)
- [Part 4: Supabase Auth settings](#part-4-supabase-auth-settings)
- [Part 5: Deploy the website](#part-5-deploy-the-website)
- [Part 6: Check everything works](#part-6-check-everything-works)
- [Updating to a new version](#updating-to-a-new-version)
- [Troubleshooting](#troubleshooting)
- [Third-party services](#third-party-services)

## What you need

- A computer with [Git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org) 20 or newer.
- A [Supabase](https://supabase.com) account (the free plan is enough to start).
- A [Resend](https://resend.com) account (the free plan is enough to start).
- A domain whose DNS records you can edit, for sending email (for example `example.com`).
- A [Vercel](https://vercel.com) account, or another static host.

Get the code and install its dependencies:

```sh
git clone https://github.com/redmonkin/core-client-hub.git clientra
cd clientra
npm install
```

All Supabase commands below use `npx supabase ...`, which runs the [Supabase CLI](https://supabase.com/docs/guides/cli) without installing it. If you prefer, [install it](https://supabase.com/docs/guides/cli/getting-started) and drop the `npx`.

## Part 1: Supabase

### 1.1 Create a project

1. Sign in to the [Supabase dashboard](https://supabase.com/dashboard) and click **New project**.
2. Choose your organization, give the project a name (for example `clientra`), and set a **database password**. Save the password in your password manager; you'll need it in step 1.4.
3. Pick the **region** closest to your users, and click **Create new project**. It takes a minute or two to start.

### 1.2 Note your project's details

You'll need these values in later steps. Keep them somewhere safe; the service role key is a secret.

| Value | Where to find it | Looks like |
| --- | --- | --- |
| Project ref | **Project Settings → General → Project ID** | `abcdefghijklmnopqrst` |
| Project URL | **Project Settings → Data API** | `https://abcdefghijklmnopqrst.supabase.co` |
| Anon key | **Project Settings → API Keys** (the `anon` `public` key; under **Legacy API keys** if you see two tabs) | `eyJhbGciOi...` |
| Service role key | Same page, the `service_role` `secret` key | `eyJhbGciOi...` |

Use the legacy **service_role** key (the long `eyJ...` one), not a newer `sb_secret_...` key: the scheduled jobs authenticate with exactly the key Supabase gives the server functions, which is the legacy one.

> The service role key bypasses all security rules. Never put it in the website's environment variables, commit it, or share it.

### 1.3 Add two Vault secrets

The scheduled jobs (reminders, recurring invoices and expenses) use these to call your server functions. Add them **before** running the migrations; the migrations stop with an error if they're missing.

In the dashboard, open **SQL Editor → New query**, paste the following with your own values, and click **Run**:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<service role key>', 'service_role_key');
```

### 1.4 Create the database

Sign in to the CLI (it opens your browser), link this folder to your project, and apply the migrations:

```sh
npx supabase login
npx supabase link --project-ref <project-ref>     # asks for the database password from 1.1
npx supabase db push                              # asks you to confirm; type Y
```

`db push` creates the tables, security (row-level security) policies, storage buckets, the `pg_cron` and `pg_net` extensions and the scheduled jobs. To check, open **Table Editor** (you should see tables such as `clients` and `invoices`) and run this in the SQL Editor:

```sql
select jobname, schedule from cron.job order by jobname;
```

You should see the reminder and recurring-invoice jobs listed.

## Part 2: Resend (email)

Clientra sends two kinds of email, and both go through Resend:

- **App email** (proposals, contracts, invoices, reminders, notifications and team invitations) is sent by the server functions using a Resend API key.
- **Account email** (sign-up confirmation and password reset) is sent by Supabase Auth, which you'll point at Resend's SMTP server in [Part 4](#part-4-supabase-auth-settings).

### 2.1 Add and verify your sending domain

1. Sign in to [Resend](https://resend.com) and open **Domains → Add Domain**.
2. Enter a subdomain you'll use only for sending, for example `notifications.example.com`. A subdomain keeps this mail's reputation separate from your main domain's everyday email. Choose the region closest to your Supabase project.
3. Resend shows several DNS records (an MX and a TXT record for SPF, and a TXT record for DKIM). At your DNS provider (for example Cloudflare, GoDaddy or Namecheap), add each record **exactly as shown**, copying the name and value with the copy buttons.
4. Optional but recommended: add a DMARC record at your DNS provider, for example a TXT record named `_dmarc.notifications.example.com` with the value `v=DMARC1; p=none;`. It helps your email avoid spam folders.
5. Back in Resend, click **Verify DNS Records**. DNS changes usually show up within minutes but can take a few hours. Wait until the domain status is **Verified**.

### 2.2 Create an API key

1. Open **API Keys → Create API Key**.
2. Name it (for example `clientra`), set **Permission** to **Sending access**, and set **Domain** to the domain you just verified.
3. Copy the key (it starts with `re_`). Resend shows it only once.

### 2.3 Choose a sender address

Pick an address on the verified domain, for example `noreply@notifications.example.com`. It doesn't need a real mailbox. You'll use it as `EMAIL_FROM_ADDRESS`.

Check Resend's pricing page for the free plan's daily and monthly sending limits, and upgrade if you expect to send more.

## Part 3: Deploy the server functions

1. Copy the example secrets file:

   ```sh
   cp supabase/functions/.env.example supabase/functions/.env
   ```

2. Open `supabase/functions/.env` and fill it in:

   ```sh
   RESEND_API_KEY="re_..."                                   # from 2.2
   EMAIL_FROM_ADDRESS="noreply@notifications.example.com"    # from 2.3
   APP_URL="https://clientra.example.com"                    # your website's address, https, no trailing slash
   ```

   `APP_URL` must be exactly the address people use to open your site. Email buttons that link anywhere else are removed, and the scheduled jobs use it to build client-portal links. If you don't know the final address yet, use the Vercel address from Part 5 and update it later.

   You don't set `SUPABASE_URL` or the Supabase keys here; Supabase provides them to every function automatically.

3. Upload the secrets and deploy all the functions:

   ```sh
   npx supabase secrets set --env-file supabase/functions/.env
   npx supabase functions deploy
   ```

   `supabase/config.toml` already marks which functions must be callable without a signed-in user (the client portal, email sending and scheduled jobs). Each of those checks its caller itself.

4. In the dashboard, open **Edge Functions**. You should see functions such as `client-portal`, `send-proposal-email` and `invoice-due-reminders`.

`supabase/functions/.env` is ignored by Git. Don't commit it.

## Part 4: Supabase Auth settings

All of these are in the Supabase dashboard under **Authentication**.

### 4.1 Website address and redirects

In **URL Configuration**:

- **Site URL**: your website's address, the same as `APP_URL` (for example `https://clientra.example.com`).
- **Redirect URLs**: add `https://clientra.example.com/dashboard` and `https://clientra.example.com/reset-password` (using your own address).

If you also want to sign in from `npm run dev` on your computer, add `http://localhost:8080/dashboard` and `http://localhost:8080/reset-password` too.

### 4.2 Send account email through Resend

Supabase's built-in mail server is only for testing: it sends very few emails per hour and may only deliver to your own team's addresses. Point it at Resend instead.

1. Open **Emails → SMTP Settings** and turn on **Enable custom SMTP**.
2. Fill in:

   | Field | Value |
   | --- | --- |
   | Sender email | your `EMAIL_FROM_ADDRESS`, for example `noreply@notifications.example.com` |
   | Sender name | `Clientra`, or your company's name |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | your Resend API key (`re_...`) |

3. Save.
4. Open **Rate Limits** and raise **Rate limit for sending emails** to suit your sign-up volume (Supabase sets a low default when custom SMTP is first turned on).

Optional: under **Emails → Templates**, edit the wording of the confirmation and password-reset emails.

### 4.3 Sign-up and password rules

In **Sign In / Providers → Email**:

- Keep **Confirm email** on, so people must confirm their address.
- Set **Minimum password length** to `10` and **Password requirements** to lowercase, uppercase and digits. This matches the rules the app checks.

### 4.4 Optional: sign-up and team limits

The migrations create a one-row `app_settings` table with `max_workspaces = 10` and `max_members_per_workspace = 5`, the limits of the upstream hosted free plan. For your own install you probably want no limits: in **Table Editor → app_settings**, set both columns to `NULL`.

## Part 5: Deploy the website

### On Vercel

1. Push your copy of the code to your own GitHub repository (or fork this one).
2. In Vercel, click **Add New → Project** and import the repository. Vercel detects Vite; keep the build command `npm run build` and the output directory `dist`.
3. Under **Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Project URL from 1.2 |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key from 1.2 (**not** the service role key) |
   | `VITE_SUPABASE_PROJECT_ID` | Project ref from 1.2 |
   | `VITE_SITE_URL` | your website's address, for example `https://clientra.example.com` |
   | `VITE_REPO_URL` | optional: your repository's URL, for the landing page's GitHub links |
   | `VITE_CONTACT_EMAIL` | optional: shown when sign-ups are full |

   Every `VITE_` value is visible to anyone who opens the site, so never put a secret here. The full list is in [`.env.example`](../.env.example).

4. Click **Deploy**.
5. To use your own domain, open **Settings → Domains**, add it and follow Vercel's DNS instructions. Then, under the `*.vercel.app` domain, choose **Redirect to** your own domain, so search engines see one address.
6. If the website's address changed, update `APP_URL` (Part 3, then run `npx supabase secrets set --env-file supabase/functions/.env` again), `VITE_SITE_URL` (then redeploy), and the Auth URLs (4.1).

### On another host

Build with the environment variables above set:

```sh
npm run build    # outputs dist/
```

Upload `dist/` and configure the host so that `/` serves `index.html` (the landing page, pre-rendered for search engines) and every other path that isn't a file is served `/app.html`. [`vercel.json`](../vercel.json) shows the exact rewrite and the security headers to copy; Netlify, Cloudflare Pages and nginx can all do the same.

## Part 6: Check everything works

1. Open your website and **sign up**. A confirmation email should arrive from your sender address within a minute. Click the link; you should land on the dashboard.
2. Use **Forgot password?** on the sign-in page to check the password-reset email.
3. Add a client with **your own email address**, create a proposal and **send it**. The email should arrive, and its button should open the client portal.
4. Create an invoice and email it to yourself.
5. In **Settings**, under **Team**, invite a second email address you own, and check the invitation arrives.

If any email doesn't arrive, see [Troubleshooting](#troubleshooting).

## Updating to a new version

```sh
git pull                          # or sync your fork
npm install
npx supabase db push              # applies any new migrations
npx supabase functions deploy     # redeploys the server functions
```

Then redeploy the website (Vercel does this automatically when you push to your repository). Read the release notes first: they mention any new secret or setting.

## Troubleshooting

**`db push` fails with "Missing Vault secret".** Run the two `vault.create_secret` lines from [1.3](#13-add-two-vault-secrets), then run `npx supabase db push` again.

**No sign-up or password-reset emails.** These come from Supabase Auth, not the server functions. Check the SMTP settings in [4.2](#42-send-account-email-through-resend) (the password is the Resend API key, the username is `resend`), that the sender address is on your verified domain, and the email rate limit. **Authentication → Logs** shows errors.

**No proposal, invoice or reminder emails.** Open **Edge Functions → (the function) → Logs** in Supabase. Common causes: `RESEND_API_KEY` or `EMAIL_FROM_ADDRESS` not set (rerun `npx supabase secrets set ...`), the domain isn't verified in Resend yet, or the sender address isn't on the verified domain. Resend's **Emails** page shows every email it accepted and whether it was delivered.

**Emails arrive but have no buttons.** `APP_URL` doesn't match your website's address exactly (check `https` and that there's no trailing slash).

**Emails go to spam.** Make sure the SPF and DKIM records show as verified in Resend, add a DMARC record ([2.1](#21-add-and-verify-your-sending-domain)), and send from a subdomain rather than your main domain.

**Clicking the confirmation link opens the wrong site, or says the link is invalid.** Check the Site URL and Redirect URLs in [4.1](#41-website-address-and-redirects).

**"Free access is full" on the sign-up page.** The workspace limit in `app_settings` is reached. Set it to `NULL` ([4.4](#44-optional-sign-up-and-team-limits)).

**Pages other than the home page show "404" on your host.** The host isn't rewriting unknown paths to `/app.html` (see [Part 5](#on-another-host)).

**Scheduled reminders never go out.** Check the jobs exist (`select * from cron.job;`) and their latest runs (`select * from cron.job_run_details order by start_time desc limit 20;`). If the calls fail with 401, the `service_role_key` Vault secret isn't the legacy service role key; update it under **Project Settings → Vault**.

**The project stopped responding after a quiet week.** Supabase pauses free-plan projects after a period of inactivity. Restore it from the dashboard, or move to a paid plan for anything you rely on.

## Third-party services

| Service | Used for | Needed? |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Database, sign-in, file storage, server functions and scheduled jobs | Yes |
| [Resend](https://resend.com) | All email: app email through its API, account email through its SMTP server | Yes, for any email. Without it the app works but nothing is emailed |
| Static hosting (Vercel, Netlify, Cloudflare Pages, nginx...) | Serving the website | Yes, any of them |
| [Have I Been Pwned](https://haveibeenpwned.com/API/v3#PwnedPasswords) | Checking new passwords against known breaches. Only the first 5 characters of the password's SHA-1 hash leave the browser; no account or key is needed | Called automatically; sign-up still works if it's unreachable |
| Google Fonts | The Inter, Poppins and Hurricane typefaces, loaded by the browser | Called automatically |
| GitHub (`raw.githubusercontent.com`) | The Poppins font in invoice PDFs made by the recurring-invoice job | Called automatically; falls back to a built-in font |

Clientra uses no analytics, advertising or tracking services.
