# PWA Deployment Notes

This project uses `vite-plugin-pwa` to generate a service worker and manifest at build time. When deploying to production, ensure the following to avoid client‑side “network error” issues and missing assets:

- Runtime caching rule should target same‑origin API paths, not localhost.
  - In `frontend/vite.config.ts` (workbox.runtimeCaching):
    ```ts
    // Replace localhost matcher with same-origin check
    urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
    ```

- Ensure icons referenced in the manifest exist and are copied to the build output.
  - Add at minimum:
    - `frontend/public/icons/icon-192.png`
    - `frontend/public/icons/icon-512.png`
  - Optional (used by index.html):
    - `frontend/public/icons/apple-touch-icon.png`
    - `frontend/public/icons/favicon-32x32.png`
    - `frontend/public/icons/favicon-16x16.png`

- After deploying a new service worker, clients may need to refresh/update.
  - Browser DevTools → Application → Service Workers → Unregister, then reload
  - Or use the “Update on reload” checkbox once to ensure fresh SW

- Nginx serves the frontend from `frontend/dist`. No special Nginx rules are required for the PWA beyond serving static files and proxying `/api/*` to the backend.

