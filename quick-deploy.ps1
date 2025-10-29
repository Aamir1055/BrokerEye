Write-Host "Quick Deploy to XAMPP" -ForegroundColor Cyan

$dist = ".\dist\*"
$destination = "C:\xampp\htdocs\"

Write-Host "`nCopying files..." -ForegroundColor Yellow
Copy-Item -Path $dist -Destination $destination -Recurse -Force

Write-Host "Deployed!" -ForegroundColor Green
Write-Host "`nAccess at: http://185.136.159.142" -ForegroundColor White
Write-Host "`nNote: Clear browser cache to see changes." -ForegroundColor Yellow
