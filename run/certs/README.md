# Organization CA certificates

**Where the files live is configuration:** set `ORG_CA_FILE` (and, for gateway HTTPS,
`GATEWAY_TLS_CERT_FILE` and `GATEWAY_TLS_KEY_FILE`) in `run/env/local.env` to any path
(absolute, `~/...`, or relative to `run/`), e.g. `ORG_CA_FILE=/etc/pki/org/ca-bundle.crt`.
`run/run.sh` copies them here as `org-ca.crt`, `gateway.crt` and `gateway.key`
(git-ignored; staged into every image build context as `certs/`, without keys). With the settings empty, files you place here
yourself under those names are used. Everything below refers to those copies.

Put your internal CA chain in `org-ca.crt` (PEM text, one or more certificates; the same file you import into browsers and the OS trust store). When the file exists,
every build and run trusts it in addition to the public CAs, so npm registries, proxies, OIDC,
webhooks and Git sources behind your CA work. Without it nothing changes. The file is git-ignored.

- Image builds (every stage that downloads, including the nginx images' `apk upgrade`): appended to the system bundle (apk, curl, git) and `NODE_EXTRA_CA_CERTS` for npm, pnpm and corepack.
- Final images (api, worker, ops, renderer): the same cert is appended to the system store (git, curl) and set as `NODE_EXTRA_CA_CERTS`; the renderer also adds each certificate to Chromium's NSS database. Images rebuild by themselves after it changes (it is part of their input hash): `run/run.sh podman:stack:deploy`.
- Keycloak: `KC_TRUSTSTORE_PATHS` points at it.
- Local runs (`run/run.sh local:...`, tests on local Node): `NODE_EXTRA_CA_CERTS` is set.
  `org-ca.crt` is for reaching services behind your organization's CA. It does not make browsers trust
  the road-map gateway; that needs the project CA below.

## Project CA and the gateway (what your browser must trust)

On first deploy `run/run.sh` creates a project CA (`ca.crt`, `ca.key`, CN "road-map development CA")
and one server certificate per component signed by it, valid 365 days, naming `localhost` and
`127.0.0.1`. The gateway serves `https://localhost:8443` with `gateway.crt`; port 18080 only redirects
there. Deploy refuses a `gateway.crt` that the project CA did not issue, so a certificate supplied
through `GATEWAY_TLS_CERT_FILE` must be signed by `ca.crt` too.

To open the application without a certificate error, trust `ca.crt` (not `org-ca.crt`) as an authority:

- Chrome, Chromium, Edge and Chromium-based apps on Linux (including the Claude desktop app's
  browser pane) read the NSS database. With `libnss3-tools` installed:
  `certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -n "road-map development CA" -i run/certs/ca.crt`,
  then restart the browser.
- Firefox: Settings > Privacy & Security > View Certificates > Authorities > Import.
- curl and other OpenSSL tools: `--cacert run/certs/ca.crt`, or the Linux system store (copy to
  `/usr/local/share/ca-certificates/road-map-dev-ca.crt` and run `sudo update-ca-certificates`).

Deleting `run/certs/*.crt` and `*.key` and deploying again creates a new CA, which must then be
trusted again. `run/run.sh status` warns 30 days before a certificate expires.
