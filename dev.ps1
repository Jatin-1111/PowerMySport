Write-Host "`n=== PowerMySport Development Environment ===" -ForegroundColor Cyan
Write-Host "Starting all services...`n" -ForegroundColor Yellow

Write-Host "Server:    http://localhost:5000" -ForegroundColor Green
Write-Host "Client:    http://localhost:3000" -ForegroundColor Green
Write-Host "Admin:     http://localhost:3001" -ForegroundColor Green
Write-Host "Community: http://localhost:3002" -ForegroundColor Green
Write-Host ""

# Function to start a service in a new PowerShell window
function Start-Service {
    param(
        [string]$Name,
        [string]$Command,
        [string]$Color = "White"
    )
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { Write-Host '$Name' -ForegroundColor $Color; cd '$PSScriptRoot'; $Command }"
}

# Start all services in separate windows
Start-Service -Name "SERVER (Port 5000)" -Command "cd server; npm run dev" -Color "Blue"
Start-Sleep -Milliseconds 500

Start-Service -Name "CLIENT (Port 3000)" -Command "cd client; npm run dev" -Color "Green"
Start-Sleep -Milliseconds 500

Start-Service -Name "ADMIN (Port 3001)" -Command "cd admin; npm run dev -- --port 3001" -Color "Yellow"
Start-Sleep -Milliseconds 500

Start-Service -Name "COMMUNITY (Port 3002)" -Command "cd community; npm run dev -- --port 3002" -Color "Magenta"

Write-Host "`nAll services started in separate windows!" -ForegroundColor Green
Write-Host "`nTo stop all services, close each PowerShell window." -ForegroundColor Yellow
Write-Host "Press any key to close this window (services will continue running)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
