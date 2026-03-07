Write-Host "`n=== PowerMySport Development Environment ===" -ForegroundColor Cyan
Write-Host "Starting all services in one terminal...`n" -ForegroundColor Yellow

Write-Host "Server:    http://localhost:5000" -ForegroundColor Blue
Write-Host "Client:    http://localhost:3000" -ForegroundColor Green
Write-Host "Admin:     http://localhost:3001" -ForegroundColor Yellow
Write-Host "Community: http://localhost:3002" -ForegroundColor Magenta
Write-Host "`nPress Ctrl+C to stop all services`n" -ForegroundColor Gray

$env:FORCE_COLOR = "1"

# Create wrapper scripts with absolute paths
$rootPath = $PSScriptRoot
$wrappers = @(
    @{Dir = "server"; Port = ""; File = "_server.ps1" },
    @{Dir = "client"; Port = ""; File = "_client.ps1" },
    @{Dir = "admin"; Port = "-- --port 3001"; File = "_admin.ps1" },
    @{Dir = "community"; Port = "-- --port 3002"; File = "_community.ps1" }
)

foreach ($w in $wrappers) {
    $targetPath = Join-Path $rootPath $w.Dir
    $content = "Set-Location '$targetPath'`nnpm run dev $($w.Port)"
    Set-Content -Path $w.File -Value $content
}

# Run each service from its wrapper
npx concurrently `
    --kill-others-on-fail `
    -n "SERVER,CLIENT,ADMIN,COMMUNITY" `
    -c "bgBlue.bold,bgGreen.bold,bgYellow.bold,bgMagenta.bold" `
    "powershell -File _server.ps1" `
    "powershell -File _client.ps1" `
    "powershell -File _admin.ps1" `
    "powershell -File _community.ps1"
