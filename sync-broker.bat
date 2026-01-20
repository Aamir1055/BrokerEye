@echo off
cd /d "c:\Users\shaik\OneDrive\Desktop\Broker Eye\Broker Eye"

echo Cleaning cherry-pick state...
del /f /q .git\CHERRY_PICK_HEAD 2>nul
del /f /q .git\MERGE_MSG 2>nul

echo.
echo Current branch:
git branch --show-current

echo.
echo Staging changes...
git add -A

echo.
echo Committing...
git commit -m "Sync UI improvements from amari-capital to broker: unified headers and table layouts"

echo.
echo Pushing to broker...
git push origin broker

echo.
echo Switching to amari-capital...
git checkout amari-capital

echo.
echo Done! Check output above for any errors.
pause
