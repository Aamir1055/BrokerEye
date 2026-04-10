# Migration Guide: Moving from htdocs/amari-capital-new to htdocs (Root)

## Overview
This guide covers the complete migration of your Broker Eye application from a subdirectory (`htdocs/amari-capital-new`) to the root htdocs directory.

## What Was Changed

### 1. **Configuration Files Updated** ✅

#### a) [.htaccess](.htaccess)
- ✅ Changed `RewriteBase` from `/amari-capital/` to `/`
- ✅ Updated API proxy condition from `^/amari-capital/api/` to `^/api/`

#### b) [vite.config.js](vite.config.js)
- ✅ Changed `base` from `'/amari-capital/'` to `'/'`

#### c) [src/App.jsx](src/App.jsx)
- ✅ Updated router `basename` to return `'/'` instead of `'/amari-capital'`

### 2. **New Deployment Script Created** ✅

- Created: [deploy-htdocs-root.ps1](deploy-htdocs-root.ps1)
- This script builds and guides you through deploying to `C:\xampp\htdocs\`

---

## Deployment Steps

### Option 1: Using the Automated Script (Recommended)

1. **Run the deployment script:**
   ```powershell
   .\deploy-htdocs-root.ps1
   ```

2. **The script will:**
   - Build the production bundle
   - Open the `dist` folder
   - Connect to Remote Desktop
   - Show step-by-step instructions

3. **Follow the on-screen instructions**

### Option 2: Manual Deployment

1. **Build the project:**
   ```powershell
   npm run build
   ```

2. **Connect to your server:**
   - Server IP: `185.136.159.142`
   - User: `Administrator`

3. **Backup existing files (if needed):**
   ```powershell
   mkdir C:\xampp\htdocs-backup
   robocopy C:\xampp\htdocs C:\xampp\htdocs-backup /E /XD brk-eye-adm
   ```

4. **Clean the htdocs folder:**
   ```powershell
   cd C:\xampp\htdocs
   Get-ChildItem -Exclude "brk-eye-adm" | Remove-Item -Recurse -Force
   ```

5. **Copy new files from dist to htdocs:**
   - Copy ALL files from your local `dist` folder
   - Paste into `C:\xampp\htdocs\`

6. **Verify deployment:**
   - Check `C:\xampp\htdocs\index.html` exists
   - Check `C:\xampp\htdocs\assets` folder exists
   - Check `.htaccess` file is present

---

## Testing

### Local Testing (Before Deployment)
```powershell
npm run dev
```
- Open: `http://localhost:5173/`
- Test all routes and functionality

### Production Testing (After Deployment)
- Visit: `http://185.136.159.142/`
- Test:
  - ✅ Login page loads
  - ✅ Dashboard loads after login
  - ✅ All navigation links work
  - ✅ API calls work correctly
  - ✅ WebSocket connections work
  - ✅ All modules function properly

---

## URL Changes

| Component | Old URL | New URL |
|-----------|---------|---------|
| Login Page | `http://185.136.159.142/amari-capital-new/login` | `http://185.136.159.142/login` |
| Dashboard | `http://185.136.159.142/amari-capital-new/dashboard` | `http://185.136.159.142/dashboard` |
| Clients | `http://185.136.159.142/amari-capital-new/client2` | `http://185.136.159.142/client2` |
| API Proxy | `/amari-capital-new/api/*` → Backend | `/api/*` → Backend |

---

## Important Notes

### ⚠️ **CRITICAL:**
- **Backup Important Data:** Always backup the admin panel (`brk-eye-adm`) and any other critical files before cleaning htdocs
- **Clean Htdocs:** Remove all old files from htdocs to avoid conflicts between old and new deployments
- **Apache Config:** Ensure Apache's `httpd.conf` has `AllowOverride All` for the htdocs directory

### 📝 **Configuration Requirements:**

1. **Apache .htaccess must be enabled:**
   ```apache
   <Directory "C:/xampp/htdocs">
       AllowOverride All
       Require all granted
   </Directory>
   ```

2. **Apache modules required:**
   - `mod_rewrite` (URL rewriting)
   - `mod_proxy` (API proxying)
   - `mod_proxy_http` (HTTP proxy)
   - `mod_proxy_wstunnel` (WebSocket proxy)

3. **Backend API must be running:**
   - Backend should be running on `http://185.136.159.142:8080`
   - API endpoints: `http://185.136.159.142:8080/api/*`
   - WebSocket: `ws://185.136.159.142:8080/api/broker/ws`

---

## Troubleshooting

### Issue: 404 Not Found
- **Cause:** .htaccess not working
- **Fix:** Enable `AllowOverride All` in Apache config

### Issue: API calls fail
- **Cause:** Backend not running or proxy misconfigured
- **Fix:** 
  1. Check backend is running on port 8080
  2. Verify .htaccess proxy rules
  3. Check Apache proxy modules are enabled

### Issue: Assets not loading
- **Cause:** Base path mismatch
- **Fix:** Verify `vite.config.js` has `base: '/'`

### Issue: Routing doesn't work
- **Cause:** Router basename incorrect
- **Fix:** Verify `App.jsx` returns `'/'` in getBasename()

### Issue: WebSocket disconnects
- **Cause:** Proxy configuration
- **Fix:** Check .htaccess WebSocket proxy rules and ensure `mod_proxy_wstunnel` is enabled

---

## Rollback Plan

If you need to rollback to the subdirectory setup:

1. **Stop deployment**

2. **Revert configuration changes:**
   ```powershell
   git checkout .htaccess vite.config.js src/App.jsx
   ```

3. **Rebuild:**
   ```powershell
   npm run build
   ```

4. **Deploy to subdirectory using old script:**
   ```powershell
   .\deploy-amari-capital-new.ps1
   ```

---

## Summary

✅ **Configuration Updated:** All files now point to root directory  
✅ **Deployment Script Created:** Use `deploy-htdocs-root.ps1`  
✅ **Testing:** Test locally before deploying to production  
✅ **Backup:** Always backup before cleaning htdocs  
✅ **Verify:** Check all functionality after deployment  

---

## Next Steps

1. **Test locally:**
   ```powershell
   npm run dev
   ```

2. **Build for production:**
   ```powershell
   npm run build
   ```

3. **Deploy using script:**
   ```powershell
   .\deploy-htdocs-root.ps1
   ```

4. **Verify on production:**
   - Visit: http://185.136.159.142/
   - Test all features

---

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review Apache error logs: `C:\xampp\apache\logs\error.log`
3. Check browser console for errors
4. Verify backend API is running

**Migration completed successfully!** 🎉
