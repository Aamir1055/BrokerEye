#!/usr/bin/env pwsh
# Sync broker branch with amari-capital UI improvements

Set-Location "c:\Users\shaik\OneDrive\Desktop\Broker Eye\Broker Eye"

# Clean up any stuck cherry-pick state
if (Test-Path ".git\CHERRY_PICK_HEAD") {
    Remove-Item ".git\CHERRY_PICK_HEAD" -Force
}
if (Test-Path ".git\MERGE_MSG") {
    Remove-Item ".git\MERGE_MSG" -Force  
}

Write-Host "Current branch:"
git branch --show-current

Write-Host "`nCurrent status:"
git status --short

Write-Host "`nStaging all changes..."
git add -A

Write-Host "`nCommitting changes..."
git commit -m "Sync UI improvements from amari-capital: unified headers, table layouts, modal styles (broker branch)"

Write-Host "`nPushing to broker branch..."
git push origin broker

Write-Host "`nSwitching to amari-capital..."
git checkout amari-capital

Write-Host "`nPulling latest amari-capital..."
git pull origin amari-capital

Write-Host "`nDone! Both branches are now synced."
