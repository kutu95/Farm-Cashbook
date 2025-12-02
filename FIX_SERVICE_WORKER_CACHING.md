# Fix: Periodic Hard Refresh Required

## The Problem

Users need to periodically hard refresh the browser or the app cannot be reached. This is caused by aggressive caching in multiple layers.

## Root Causes

1. **Service Worker Cache-First Strategy**: The service worker was serving cached content first, showing stale pages
2. **Browser Cache**: Browser caching HTML responses
3. **Cloudflare Cache**: Cloudflare may be caching responses too aggressively

## Solution Applied

### 1. Updated Service Worker Strategy

Changed from **cache-first** to **network-first** for HTML pages:

- **HTML pages**: Always fetch from network first, use cache only when offline
- **Static assets** (CSS, JS, images): Cache-first for speed, but update in background
- **Other requests**: Network-first

### 2. Cache Version Updated

Updated cache version from `v1` to `v2` to force all users to get the new service worker.

## What Changed

**Before:**
- Service worker served cached HTML first
- Users saw stale content until hard refresh
- Cache never updated automatically

**After:**
- Service worker always fetches fresh HTML from network
- Cache only used when offline
- Static assets still cached for performance
- Background updates keep cache fresh

## Deployment Steps

1. **Deploy the updated service worker:**
   ```bash
   # On your Mac, commit and push changes
   git add public/sw.js
   git commit -m "Fix: Update service worker to network-first strategy"
   git push
   ```

2. **Rebuild and deploy the app:**
   ```bash
   # On server
   cd ~/apps/cashbook
   git pull
   npm run build
   pm2 restart farm-cashbook
   ```

3. **Users will automatically get the update:**
   - The new cache version (`v2`) will trigger service worker update
   - Old cache will be cleared automatically
   - Users may need to refresh once to get the new service worker

## Cloudflare Cache Settings

Check Cloudflare cache settings to ensure they're not too aggressive:

1. Go to Cloudflare Dashboard → `landlife.au` → **Caching** → **Configuration**
2. **Caching Level**: Set to "Standard"
3. **Browser Cache TTL**: Set to "Respect Existing Headers" or "4 hours"
4. **Always Online**: Can be enabled for offline support

### Page Rules (Optional)

You can create a page rule to bypass cache for HTML:

1. Go to **Rules** → **Page Rules**
2. Create rule: `books.landlife.au/*`
3. Settings:
   - **Cache Level**: Bypass (for HTML)
   - Or: **Edge Cache TTL**: 2 hours

**Note:** The service worker fix should be sufficient. Only adjust Cloudflare if issues persist.

## Testing

After deployment:

1. **Clear browser cache** (or use incognito)
2. **Visit** `https://books.landlife.au`
3. **Check service worker**:
   - Open DevTools → Application → Service Workers
   - Should see `farm-cashbook-v2` active
4. **Test network-first behavior**:
   - Make a change to the app
   - Refresh page (normal refresh, not hard refresh)
   - Should see the change immediately

## If Issues Persist

### Check Service Worker Status

1. Open DevTools (F12)
2. Go to **Application** → **Service Workers**
3. Check if service worker is active
4. Click **Unregister** if needed, then refresh

### Force Service Worker Update

Users can force update by:
1. Opening DevTools → Application → Service Workers
2. Click **Unregister**
3. Refresh page
4. New service worker will install

### Clear All Caches

```javascript
// Run in browser console:
caches.keys().then(names => {
  names.forEach(name => caches.delete(name));
});
location.reload();
```

## Prevention

To prevent this in the future:

1. **Always use network-first for HTML** in service workers
2. **Update cache version** when making significant changes
3. **Test caching behavior** after deployments
4. **Monitor Cloudflare cache settings** if issues occur

## Summary

✅ **Fixed**: Service worker now uses network-first for HTML  
✅ **Fixed**: Cache version updated to force refresh  
✅ **Result**: Users always get fresh content, no hard refresh needed  

The app should now always show fresh content without requiring hard refreshes.

