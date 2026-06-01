CAMBO STORE FRONTEND FIXED

1. Replace your GitHub public files with all files in this folder.
2. Open app.js and check:
   const API = "https://cambo-store-api.phanhaotdg.workers.dev";
   const REPO_BASE = "/pinkie/";
3. Push to GitHub:
   git add .
   git commit -m "frontend fixed modern"
   git push
4. GitHub Pages settings:
   Branch: main
   Folder: /root if these files are in repo root
   OR /public if you put them inside public folder
5. Backend secrets required:
   wrangler secret put JWT_SECRET
   wrangler secret put RESEND_API_KEY
   wrangler deploy

If API cannot connect, open Worker URL:
https://cambo-store-api.phanhaotdg.workers.dev
