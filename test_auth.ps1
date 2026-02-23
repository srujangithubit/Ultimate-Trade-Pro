$baseUrl = "http://localhost:3000"
$random = Get-Random
$email = "testuser$random@example.com"
$password = "Password123!"

Write-Host "1. Registering user: $email"
$registerBody = @{
    email = $email
    password = $password
    firstName = "Test"
    lastName = "User"
} | ConvertTo-Json

try {
    $regResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
    $token = $regResponse.accessToken
    Write-Host "   Success! Token received."
    # Write-Host "   Token: $token"
} catch {
    Write-Host "   Failed to register: $($_.Exception.Message)"
    $streamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    $errBody = $streamReader.ReadToEnd()
    Write-Host "   Body: $errBody"
    exit
}

Write-Host "`n2. Logging in..."
$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    if ($loginResponse.accessToken) {
        Write-Host "   Success! Login working."
    }
} catch {
    Write-Host "   Failed to login: $($_.Exception.Message)"
}

Write-Host "`n3. Creating a trade..."
$tradeBody = @{
    symbol = "AAPL"
    direction = "LONG"
    entryPrice = 150.00
    quantity = 10
    entryDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json

$headers = @{
    Authorization = "Bearer $token"
}

try {
    $tradeResponse = Invoke-RestMethod -Uri "$baseUrl/trades" -Method Post -Body $tradeBody -ContentType "application/json" -Headers $headers
    Write-Host "   Success! Trade created."
    Write-Host "   Trade ID: $($tradeResponse.id)"
} catch {
    Write-Host "   Failed to create trade: $($_.Exception.Message)"
    $streamReader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    $errBody = $streamReader.ReadToEnd()
    Write-Host "   Body: $errBody"
}
