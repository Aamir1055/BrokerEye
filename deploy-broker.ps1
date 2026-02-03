# Deploy Broker Module to XAMPP
Write-Host "Building Broker Module..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful! Deploying to XAMPP..." -ForegroundColor Green
    
    # Remove old production files
    if (Test-Path "C:\xampp\htdocs") {
        # Backup .htaccess if exists
        if (Test-Path "C:\xampp\htdocs\.htaccess") {
            Copy-Item "C:\xampp\htdocs\.htaccess" "C:\xampp\htdocs\.htaccess.backup" -Force
        }
        
        # Clear production folder (keep certain files)
        Get-ChildItem "C:\xampp\htdocs" -Exclude ".htaccess", ".htaccess.backup" | Remove-Item -Recurse -Force
        Write-Host "Cleared production folder" -ForegroundColor Yellow
    }
    
    # Copy new build files
    Copy-Item -Path "dist\*" -Destination "C:\xampp\htdocs\" -Recurse -Force
    
    # Restore .htaccess if it was backed up
    if (Test-Path "C:\xampp\htdocs\.htaccess.backup") {
        Move-Item "C:\xampp\htdocs\.htaccess.backup" "C:\xampp\htdocs\.htaccess" -Force
    }
    
    Write-Host "Deployment complete!" -ForegroundColor Green
    Write-Host "Site: https://api.brokereye.work.gd/" -ForegroundColor Cyan
} else {
    Write-Host "Build failed! Deployment cancelled." -ForegroundColor Red
}
