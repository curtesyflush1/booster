Email Deliverability Guide

Overview
- This project sends transactional emails for verification and password resets. To keep inboxing strong, configure authentication and monitoring.

DNS Authentication
- SPF: Authorize your SMTP server IP/host in SPF. Example: v=spf1 include:spf.mxroute.com -all
- DKIM: Enable DKIM signing on your SMTP provider and publish the provided public key as a TXT record.
- DMARC: Publish a DMARC policy to receive aggregate reports and enforce alignment. Example: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; ruf=mailto:dmarc@yourdomain.com; pct=100

One‑Click Unsubscribe
- The service includes List‑Unsubscribe headers for transactional emails when EMAIL_INCLUDE_UNSUBSCRIBE_IN_TRANSACTIONAL=true.
- Optional envs:
  - UNSUBSCRIBE_MAILTO: mailto address included in header (falls back to SUPPORT_EMAIL/FROM_EMAIL)
  - BACKEND_PUBLIC_URL: used to construct /api/email/unsubscribe links

Monitoring
- Gmail Postmaster Tools: Verify your sending domain to view reputation, spam rates, and delivery errors.
- Deliverability reports: Use the CLI script to view overall and per‑user stats after migrations:
  - cd backend && npm run migrate:up
  - npm run email:report
  - npm run email:report -- --email user@example.com

Local Testing
- Trigger emails via API:
  - POST /api/auth/register (verification)
  - POST /api/auth/forgot-password (reset)
- View SMTP configuration: GET /api/email/config (auth required)
- Send test: POST /api/email/config/test (auth required)

Environment
- FRONTEND_URL: public base for reset links (e.g., http://192.168.1.238:5173)
- BACKEND_PUBLIC_URL: public base for verification links (e.g., https://api.example.com)
- SMTP_*: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_TLS_REJECT_UNAUTHORIZED

