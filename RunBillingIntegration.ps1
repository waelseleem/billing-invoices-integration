# PowerShell script to run the Billing Integration executable
# and keep the console window open for logs

# Path to your executable
$exePath = ".\Billing Integration (Bani Swaif Water).exe"

# Check if the file exists
if (-Not (Test-Path $exePath)) {
    Write-Host "Error: Executable not found at path: $exePath"
    exit 1
}

# Start the executable in the same terminal
Write-Host "Starting Billing Integration..."
Start-Process -FilePath $exePath -NoNewWindow -Wait

# Optional: Keep the console open after the executable exits
Write-Host "Executable has exited. Press Enter to close this window..."
Read-Host
