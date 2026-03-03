Connect-MgGraph -TenantId "3f6dd2a4-41aa-4714-a2ff-8a36aa8ded71" -Scopes "Application.ReadWrite.All" -NoWelcome
$app = Get-MgApplication -Filter "appId eq '3a65dee4-7af5-4bd9-b715-a7e160f363d4'"
Write-Host "Current redirect URIs:"
$app.Web.RedirectUris | ForEach-Object { Write-Host "  - $_" }

$localUri = "http://localhost:3001/api/auth/callback"
$uris = [System.Collections.Generic.List[string]]::new()
$app.Web.RedirectUris | ForEach-Object { $uris.Add($_) }

if (-not $uris.Contains($localUri)) {
    $uris.Add($localUri)
    Update-MgApplication -ApplicationId $app.Id -Web @{ RedirectUris = $uris }
    Write-Host "ADDED: $localUri"
} else {
    Write-Host "Already registered: $localUri"
}

Disconnect-MgGraph 2>$null | Out-Null
Write-Host "Done!"
