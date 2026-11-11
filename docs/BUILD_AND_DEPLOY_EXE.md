# Build and Deploy the Windows Executable

The application is packaged as a single Windows `.exe` using:

- `next build` with `output: 'standalone'`
- a portable Node.js runtime (`node.exe` copied from the build machine)
- the [`caxa`](https://github.com/leafac/caxa) self-extracting stub

`scripts/package-exe.mjs` assembles the executable: it appends a `tar.gz` of the
staged bundle to the caxa stub, writes the caxa footer, and **fully extracts the
payload again to verify it** before and after assembly. A truncated or
incomplete bundle therefore fails the build instead of shipping.

## Build

From the project root:

```powershell
npm install
npm run build:exe
```

The executable is written to:

```text
dist\Billing Integration (Bani Swaif Water).exe
```

`caxa` is a dev dependency, so no `npx` download is required. The build also
copies the Oracle native addon (`oracledb`), the portable `node.exe`, and the
runtime `.env` / `.env.local` files into the package.

### Build options

```powershell
# Re-package without running "next build" again
powershell -ExecutionPolicy Bypass -File scripts\build-exe.ps1 -NoBuild

# Only prepare the staged application folder (no .exe)
powershell -ExecutionPolicy Bypass -File scripts\build-exe.ps1 -NoBuild -SkipPackage
```

## Client prerequisites

1. **Oracle Instant Client 19.26 x64** installed at:

   ```text
   C:\oracle\instantclient_19_26
   ```

   Follow `docs/SETUP_ORACLE_INSTANT_CLIENT.md`. Thick mode is required for the target Oracle database.

2. Network access from the client machine to:
   - Oracle: `192.168.11.118:1521`
   - SAP Service Layer: `https://192.168.11.22:50000`

3. Windows Firewall: allow inbound TCP port `3000` so other machines can open the dashboard.

## Run

1. Copy `dist\Billing Integration (Bani Swaif Water).exe` to the server machine (for example `C:\Billing Invoices Integration\`).
2. Double-click the executable. The first start extracts the bundled application to `%TEMP%\caxa\...` and can take a few seconds.
3. Wait for the console to show `Ready`.
4. Open the dashboard:

   ```text
   http://<server-ip>:3000/ar
   http://<server-ip>:3000/en
   ```

The server listens on all network interfaces (`0.0.0.0`) on port `3000`.

## Runtime data and logs

To survive restarts and temporary-folder cleanup, the packaged launcher stores runtime state outside the extraction folder:

```text
%LOCALAPPDATA%\BillingIntegration\logs
%LOCALAPPDATA%\BillingIntegration\data
```

`data` contains the sync schedule and the last sync status. `logs` contains the application logs.

## Optional external configuration

An `.env` or `.env.local` placed **next to the executable** is loaded before the bundled configuration and can override values such as:

```ini
SAP_SERVICE_LAYER_URL=https://192.168.11.22:50000/b1s/v1
SAP_COMPANY_DB=BS_NEW
SAP_USERNAME=BS2
SAP_PASSWORD=admin2007
```

Oracle connection settings are currently defined in `lib/services/oracle-service.ts` (`ORACLE_CONFIG`) and are compiled into the package.

## Gov journal entry mapping

The Gov tab reuses the People journal builder (`lib/services/sap-journal-integration.ts`)
and rewrites the business partner, line descriptions and reference
(`lib/services/gov-journal-integration.ts`):

| Oracle column | Account | Notes |
|---|---|---|
| `ENTAGTAM` | `511111` | إجمالي مبيعات الإنتاج التام من السلع |
| `SEWER` | `511121` | إجمالي المبيعات من الصرف الصحي المعالج |
| `CONTRACT` | `51211` | إيرادات مبيعات اخري |
| `ESTDAMA` | `324371` | جهاز التنظيم وحماية المستهلك |
| `TAXES` | `324322` | الضريبة على القيمة المضافة |
| `TANZEEM` | `324324` | الضريبة على الدمغة (line added only when the amount is non-zero) |
| `ROUNDING` | `51211` | إيرادات مبيعات اخري (rounding adjustment) |
| `WATERDEBIT` | `51211` | other revenue; the People entry posts this to `511111` |
| Business partner | `C1001` | control account `1231112` comes from the BP master data |

`SEWERDEBIT` stays on `511121`. Gov entries are grouped per branch with
reference `BILL-GOV-C1001-BR-{branch}-{YYYYMMDD}`.

## Troubleshooting

- **`DPI-1047` / "Oracle thick mode is required"**: the Oracle Instant Client is missing or not at `C:\oracle\instantclient_19_26`.
- **Port already in use**: stop the other process using port `3000`, or set `PORT` before launching the executable.
- **Windows SmartScreen prompt**: the executable is not code-signed. Choose "More info" → "Run anyway", or sign it with your organization's certificate.
- **Blank page after an update**: the old version may still be running. Close it, then start the new executable.
- **`Cannot find module 'styled-jsx/style'` (or another missing module) on start**: an interrupted start left an incomplete extraction in `%TEMP%\caxa`. Close every instance of the executable, delete `%TEMP%\caxa`, then start it again. The exe re-extracts on the next run.
