Write-Host "`n=== PowerMySport API Endpoint Testing ===" -ForegroundColor Cyan

$baseUrl = "http://localhost:5000"

function Test-API {
    param([string]$Method, [string]$Url, [string]$Name)
    
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$Url" -Method $Method -TimeoutSec 5 -UseBasicParsing
        Write-Host "  $Name - Status: $($response.StatusCode)" -ForegroundColor Green
        return $true
    }
    catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 401 -or $code -eq 403 -or $code -eq 400) {
            Write-Host "  $Name - Status: $code (Auth required)" -ForegroundColor Yellow
            return $true
        }
        Write-Host "  $Name - Error: $code" -ForegroundColor Red
        return $false
    }
}

Write-Host "`n--- Frontend Services ---" -ForegroundColor Cyan
try { $r = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing; Write-Host "  Client (3000) - Running" -ForegroundColor Green } catch { Write-Host "  Client (3000) - Error" -ForegroundColor Red }
try { $r = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 5 -UseBasicParsing; Write-Host "  Admin (3001) - Running" -ForegroundColor Green } catch { Write-Host "  Admin (3001) - Error" -ForegroundColor Red }
try { $r = Invoke-WebRequest -Uri "http://localhost:3002" -TimeoutSec 5 -UseBasicParsing; Write-Host "  Community (3002) - Running" -ForegroundColor Green } catch { Write-Host "  Community (3002) - Error" -ForegroundColor Red }

Write-Host "`n--- Auth API ---" -ForegroundColor Cyan
Test-API "POST" "/api/auth/register" "Register"
Test-API "POST" "/api/auth/login" "Login"
Test-API "GET" "/api/auth/profile" "Profile"

Write-Host "`n--- Venue API ---" -ForegroundColor Cyan
Test-API "GET" "/api/venues/discover" "Discover"
Test-API "GET" "/api/venues/search" "Search"
Test-API "GET" "/api/venues/my-venues" "My Venues"

Write-Host "`n--- Coach API ---" -ForegroundColor Cyan
Test-API "GET" "/api/coaches/my-profile" "My Profile"

Write-Host "`n--- Booking API ---" -ForegroundColor Cyan
Test-API "GET" "/api/bookings/my-bookings" "My Bookings"

Write-Host "`n--- Geo API ---" -ForegroundColor Cyan
Test-API "GET" "/api/geo/autocomplete?q=Mumbai" "Autocomplete"
Test-API "GET" "/api/geo/geocode?address=Mumbai" "Geocode"

Write-Host "`n--- Sports API ---" -ForegroundColor Cyan
Test-API "GET" "/api/sports" "Get Sports"

Write-Host "`n--- Community API ---" -ForegroundColor Cyan
Test-API "GET" "/api/community/profile" "Profile"
Test-API "GET" "/api/community/conversations" "Conversations"

Write-Host "`n=== All Tests Complete ===" -ForegroundColor Green
Write-Host "Server: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Client: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Admin: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Community: http://localhost:3002`n" -ForegroundColor Cyan
