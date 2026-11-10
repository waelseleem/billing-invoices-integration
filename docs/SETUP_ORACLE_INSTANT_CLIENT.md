# Oracle Instant Client Setup Guide (Windows x64)

This document provides step-by-step instructions to install and configure the Oracle Instant Client (`instantclient-basic-windows.x64-19.26.0.0.0dbru`) on Windows 10/11 (x64). This is required for applications that use Oracle Thick mode (e.g., node-oracledb, .NET Oracle drivers).

---

## 1. Download Oracle Instant Client

1. Go to the [Oracle Instant Client Downloads page](https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html).
2. Find **"Version 19.26.0.0.0 (64-bit)"**.
3. Download the file: `instantclient-basic-windows.x64-19.26.0.0.0dbru.zip`
4. Save it to a folder on your computer (e.g., `C:\Downloads`).

---

## 2. Extract the ZIP File

1. Right-click the downloaded ZIP file and select **Extract All...**
2. Extract to a directory, e.g., `C:\oracle\instantclient_19_26`
   - The folder should contain files like `oci.dll`, `oraociei19.dll`, etc.

---

## 3. Add Instant Client to the System PATH

1. Open **Control Panel** → **System and Security** → **System** → **Advanced system settings**.
2. Click **Environment Variables...**
3. Under **System variables**, find and select the `Path` variable, then click **Edit**.
4. Click **New** and add the path to your extracted folder, e.g.:
   ```
   C:\oracle\instantclient_19_26
   ```
5. Click **OK** to save and close all dialogs.

---

## 4. (Optional) Set TNS_ADMIN and NLS_LANG

- If you use a `tnsnames.ora` file, set the `TNS_ADMIN` variable to its directory.
- To set language/character set, set `NLS_LANG` (optional).

---

## 5. Verify the Installation

1. Open a **new** Command Prompt or PowerShell window.
2. Run:
   ```
   where oci.dll
   ```
   - You should see the path to your Instant Client directory.
3. If using Node.js, run your application. If using .NET, test your Oracle connection.

---

## 6. Troubleshooting

- If you get errors about missing DLLs, double-check the PATH and that you extracted all files.
- Make sure you are using the correct architecture (x64 for 64-bit Node.js/.NET).
- Restart your terminal or IDE after making changes to environment variables.

---

## References
- [Oracle Instant Client Downloads](https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html)
- [Oracle Instant Client Documentation](https://www.oracle.com/database/technologies/faq-instant-client.html) 