# Security Policy

## Reporting a vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, discussions or pull requests.

Report them privately through GitHub: go to the repository's **Security** tab and choose **Report a vulnerability**. Include:

- what the issue is and where it lives (file, endpoint or page),
- steps to reproduce, or a proof of concept,
- the impact you believe it has.

We aim to acknowledge reports within 3 business days and will keep you updated as we investigate. Once a fix ships, we're happy to credit you in the release notes unless you'd rather stay anonymous.

## Supported versions

Security fixes land on `main`. Self-hosted deployments should update to the latest `main` and apply any new migrations and edge functions.

## Scope

In scope: this repository's frontend, SQL migrations (including RLS policies and database functions) and Supabase edge functions.

Out of scope: vulnerabilities in Supabase, Resend or other third-party services themselves (report those to the vendor), findings that require a compromised account or device, and missing hardening headers without a demonstrated impact.

## Notes for self-hosters

- The Supabase **anon/publishable key** is public by design and is embedded in the frontend. Never expose the **service role key** to the browser. It belongs only in edge function secrets and the `service_role_key` Vault secret.
- Keep `EMAIL_FROM_ADDRESS` on a domain you control and have verified in Resend.
