# Geniura Elect Web

Next.js frontend for Geniura Elect.

## Architecture

- Next.js is the only application surface exposed to users.
- Odoo is a private backend/source of truth and is never exposed as product UI.
- Browser requests target the Next.js application.
- Backend communication is performed through server-side/BFF code.
- Secrets and backend credentials must never use `NEXT_PUBLIC_*`.

## Branches

- `main`: stable / production baseline.
- `dev`: active development and preview deployments.

## Public domain

Production frontend target:

`https://elect.geniura.com`

DNS is managed through Cloudflare and the application is deployed through Vercel.
