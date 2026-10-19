# Staff onboarding workspace

Public application: /become-a-partner/
Staff workspace: /staff/
API: https://patahaoapp-production.up.railway.app/api/staff/onboarding/

Deploy backend and apply partners.0005_partnerapplicationevent before publishing
this website version. Daily workflow uses existing staff accounts and model
permissions. Staff tokens stay in memory; no applicant or token storage is used.
Appointments are entered and displayed in Kenya time. No notifications are sent.

## DOM checks

Install jsdom in a temporary QA directory, then expose it through NODE_PATH:

```bash
npm install --prefix /tmp/patahao-dom-qa jsdom --no-audit --no-fund
NODE_PATH=/tmp/patahao-dom-qa/node_modules node tests/staff-portal.cjs
node --check public/assets/staff-portal.js
```

These tests do not replace browser layout checks or live end-to-end verification.
