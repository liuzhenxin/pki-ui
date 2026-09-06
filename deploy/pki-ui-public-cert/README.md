# FAW-VW Public Certificate Employee Portal

This nginx profile is for the employee-facing public-certificate application.

| Item | Value |
| --- | --- |
| Default host port | 9085 |
| Container port | 80 |
| Entry path | `/ra-public-cert` |
| API proxy path | `/ra-public-cert-api/` |

The root path `/` redirects to `/ra-public-cert`.

The portal API proxy forwards only the employee public-certificate endpoints to
RA through `/api/ra/v1/public-certs/portal/*`. The administrator console keeps
using `deploy/pki-ui-ra/nginx.conf` and the 9083 port.

Example:

```bash
PUBLIC_CERT_UI_PORT=9085 docker compose up -d pki-ui-public-cert
```
