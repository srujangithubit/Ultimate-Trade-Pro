$baseUrl = "http://localhost:3000"
$url = "$baseUrl/auth/register"
$body = '{"email":"test_rec_02@example.com","password":"Password123!","displayName":"TestRec"}'

Write-Host "Sending to $url"
Write-Host "Body: $body"

try {
    $res = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
    Write-Host "Success: $($res | ConvertTo-Json)"
} catch {
    Write-Host "Request failed. Status: $($_.Exception.Response.StatusCode)"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = [System.IO.StreamReader]::new($stream)
    $resp = $reader.ReadToEnd()
    Write-Host "ERROR RESPONSE: $resp"
}
