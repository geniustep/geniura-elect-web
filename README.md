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
- `dev`: active development. Automatic Vercel deployments are disabled for this branch.

## Public domain

Production frontend target:

`https://elect.geniura.com`

DNS is managed through Cloudflare and the application is deployed through Vercel.


## Implemented application flows

- secure BFF session bridge to the Odoo backend;
- login / logout / current-user session;
- election dashboard;
- polling-office list and office detail;
- representative check-in;
- protocol/PV entry with local arithmetic checks;
- protocol document upload and review actions;
- command-center operational view;
- verified-result aggregation and internal seat-calculation views.

The results UI always preserves the backend distinction between internal
calculation/projection and official results.


## Election-day operations

Polling-office pages now support election-day incident reporting. Assigned users can
record operational incidents with category and urgency, while coordinator/manager
roles can acknowledge, resolve and close them through the BFF. Command Center shows
open incident counts alongside coverage and protocol completion.
