# Deploy to htdocs root folder on production
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploy to htdocs Root Directory" -ForegroundColor Cyan
Write-Host "Target: http://185.136.159.142/" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: Build
Write-Host "`nStep 1: Building production bundle..." -ForegroundColor Yellow

if (Test-Path ".\dist") {
    Remove-Item -Path ".\dist" -Recurse -Force
}

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBuild failed! Please fix errors first." -ForegroundColor Red
    exit 1
}

Write-Host "`nBuild completed successfully!" -ForegroundColor Green

# Step 2: Open the dist folder
Write-Host "`nStep 2: Opening dist folder..." -ForegroundColor Yellow
Start-Process explorer.exe -ArgumentList ".\dist"
Start-Sleep -Seconds 2

# Step 3: Open Remote Desktop
Write-Host "`nStep 3: Opening Remote Desktop Connection..." -ForegroundColor Yellow
Write-Host "Connecting to: 185.136.159.142" -ForegroundColor Cyan

$rdpContent = @"
full address:s:185.136.159.142
username:s:Administrator
"@

$rdpFile = ".\remote-server.rdp"
$rdpContent | Out-File -FilePath $rdpFile -Encoding ASCII

Start-Process mstsc.exe -ArgumentList $rdpFile

Start-Sleep -Seconds 3

# Step 4: Show instructions
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT INSTRUCTIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Wait for Remote Desktop to connect" -ForegroundColor White
Write-Host "2. Navigate to: C:\xampp\htdocs\" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. BACKUP existing files (if any):" -ForegroundColor White
Write-Host "   - Create folder: C:\xampp\htdocs-backup" -ForegroundColor Gray
Write-Host "   - Copy important files to backup folder" -ForegroundColor Gray
Write-Host ""
Write-Host "4. CLEAN the htdocs folder:" -ForegroundColor White
Write-Host "   - Delete ALL files in C:\xampp\htdocs\" -ForegroundColor Red
Write-Host "   - EXCEPT: Keep 'brk-eye-adm' folder (if exists)" -ForegroundColor Yellow
Write-Host ""
Write-Host "5. COPY new files:" -ForegroundColor White
Write-Host "   - From your local 'dist' folder" -ForegroundColor Gray
Write-Host "   - To: C:\xampp\htdocs\" -ForegroundColor Gray
Write-Host "   - Copy ALL files and folders from dist" -ForegroundColor Gray
Write-Host ""
Write-Host "6. VERIFY deployment:" -ForegroundColor White
Write-Host "   - Check C:\xampp\htdocs\index.html exists" -ForegroundColor Gray
Write-Host "   - Check C:\xampp\htdocs\assets folder exists" -ForegroundColor Gray
Write-Host "   - Check .htaccess file is present" -ForegroundColor Gray
Write-Host ""
Write-Host "7. TEST the application:" -ForegroundColor White
Write-Host "   - Visit: http://185.136.159.142/" -ForegroundColor Cyan
Write-Host "   - Login and verify functionality" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "QUICK COMMANDS (Run in Remote Desktop)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "# Backup existing files:" -ForegroundColor Yellow
Write-Host 'mkdir C:\xampp\htdocs-backup' -ForegroundColor White
Write-Host 'robocopy C:\xampp\htdocs C:\xampp\htdocs-backup /E /XD brk-eye-adm' -ForegroundColor White
Write-Host ""
Write-Host "# Clean htdocs (keep brk-eye-adm):" -ForegroundColor Yellow
Write-Host 'cd C:\xampp\htdocs' -ForegroundColor White
Write-Host 'Get-ChildItem -Exclude "brk-eye-adm" | Remove-Item -Recurse -Force' -ForegroundColor White
Write-Host ""
Write-Host "# Copy from network share (if mapped as Z:):" -ForegroundColor Yellow
Write-Host 'robocopy Z:\path\to\dist C:\xampp\htdocs /E' -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "The 'dist' folder is now open." -ForegroundColor Green
Write-Host "Copy all its contents to C:\xampp\htdocs\" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
