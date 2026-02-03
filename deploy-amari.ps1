# Deploy Amari Capital to XAMPP
Write-Host "Building Amari Capital..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful! Deploying to XAMPP..." -ForegroundColor Green
    
    # Remove old production files
    if (Test-Path "C:\xampp\htdocs\amari-capital") {
        Remove-Item "C:\xampp\htdocs\amari-capital\*" -Recurse -Force
        Write-Host "Cleared production folder" -ForegroundColor Yellow
    }
    
    # Copy new build files
    Copy-Item -Path "dist\*" -Destination "C:\xampp\htdocs\amari-capital\" -Recurse -Force
    Write-Host "Deployment complete!" -ForegroundColor Green
    Write-Host "Site: https://api.brokereye.work.gd/amari-capital/" -ForegroundColor Cyan
} else {
    Write-Host "Build failed! Deployment cancelled." -ForegroundColor Red
}
