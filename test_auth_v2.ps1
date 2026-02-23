$baseUrl = "http://localhost:3000"
$id = (Get-Date).Ticks
$email = "user_$id@example.com"
$password = "StrongPass123!"

Write-Output "--- START AUTH TEST ---"
Write-Output "Target: $baseUrl"
Write-Output "Email: $email"

# 1. Register
try {
    Write-Output "`n[1] Registering..."
    $body = @{ 
        email = $email
        password = $password
        displayName = "Test User $id" 
    } | ConvertTo-Json -Depth 10

    $res = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
    $token = $res.accessToken
    if ($token) {
        Write-Output "    SUCCESS. Token received (Length: $($token.Length))."
    } else {
        Write-Output "    FAILED. No token in response."
        exit
    }
} catch {
    Write-Output "    FAILED: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output "    Response Body: $($reader.ReadToEnd())"
    }
    exit
}

# 2. Create Trade
try {
    Write-Output "`n[2] Creating Trade..."
    $trade = @{ 
        symbol = "AAPL"
        direction = "LONG"
        entryPrice = 150.50
        quantity = 10
        entryDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
        # accountId is optional now, so omitting it
    } | ConvertTo-Json -Depth 10

    $headers = @{ Authorization = "Bearer $token" }
    
    $res = Invoke-RestMethod -Uri "$baseUrl/trades" -Method Post -Body $trade -ContentType "application/json" -Headers $headers -ErrorAction Stop
    Write-Output "    SUCCESS. Trade ID: $($res.id)"
    Write-Output "    Symbol: $($res.symbol)"
} catch {
    Write-Output "    FAILED: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Output "    Response Body: $($reader.ReadToEnd())"
    }
}

Write-Output "`n--- END AUTH TEST ---"
