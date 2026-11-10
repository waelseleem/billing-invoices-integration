# Hide console window if desired
Add-Type -Name Window -Namespace Console -MemberDefinition @"
    [DllImport("kernel32.dll")]
    public static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
"@
$consolePtr = [Console.Window]::GetConsoleWindow()
# 0 = hide, 1 = normal
[Console.Window]::ShowWindow($consolePtr, 1)

# Navigate to project folder
Set-Location "C:\Billing Invoices Integration\"

# Start the Next.js server in production mode
Start-Process "cmd.exe" -ArgumentList "/c npm run start" -WindowStyle Normal
