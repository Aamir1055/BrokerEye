# Quick Deploy Script for Broker Eyes Frontend to XAMPP
# Run this script after making any changes to deploy to production

Write-Host "🚀 Starting deployment..." -ForegroundColor Cyan

# Step 1: Build the production bundle
Write-Host "`n📦 Building production bundle..." -ForegroundColor Yellow
cd "C:\Users\Administrator\Desktop\Broker Eyes Frontend\Broker Eye"
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Please fix errors and try again." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully!" -ForegroundColor Green

# Step 2: Copy files to XAMPP
Write-Host "`n📁 Copying files to XAMPP htdocs..." -ForegroundColor Yellow

$source = ".\dist\*"
$destination = "C:\xampp\htdocs\"

# Check if XAMPP htdocs exists
if (-not (Test-Path $destination)) {
    Write-Host "❌ XAMPP htdocs folder not found at: $destination" -ForegroundColor Red
    Write-Host "Please verify XAMPP is installed or update the path in this script." -ForegroundColor Yellow
    exit 1
}

# Backup existing files (optional)
# $backupFolder = "C:\xampp\htdocs_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
# Write-Host "Creating backup at: $backupFolder" -ForegroundColor Gray
# New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
# Copy-Item -Path "$destination*" -Destination $backupFolder -Recurse -Force -Exclude "brk-eye-adm"

# Copy new files
try {
    Copy-Item -Path $source -Destination $destination -Recurse -Force
    Write-Host "✅ Files copied successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to copy files: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Verify deployment
Write-Host "`n🔍 Verifying deployment..." -ForegroundColor Yellow

$requiredFiles = @(
    "C:\xampp\htdocs\index.html",
    "C:\xampp\htdocs\.htaccess",
    "C:\xampp\htdocs\assets"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ Found: $file" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ Missing: $file" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host "`n⚠️  Some files are missing. Deployment may not work correctly." -ForegroundColor Yellow
    exit 1
}

# Success message
Write-Host "`n✨ Deployment completed successfully!" -ForegroundColor Green
Write-Host "`n📍 Access your app at:" -ForegroundColor Cyan
Write-Host "   Frontend: http://185.136.159.142" -ForegroundColor White
Write-Host "   Admin Panel: http://185.136.159.142/brk-eye-adm" -ForegroundColor White
Write-Host "`n⚠️  Remember to:" -ForegroundColor Yellow
Write-Host "   1. Ensure Apache modules are enabled (mod_rewrite, mod_proxy, mod_proxy_wstunnel, mod_headers)" -ForegroundColor Gray
Write-Host "   2. Restart Apache if you made config changes" -ForegroundColor Gray
Write-Host "   3. Verify backend API is running on port 8080" -ForegroundColor Gray
Write-Host "`n✅ Done!" -ForegroundColor Green
