# Phoenix Movies DSX

A React + Express media library for uploading and browsing MP4 movies and audio files. Each upload has a title and category. The backend streams media from disk and supports files up to **2 GB per file**.

## Requirements
- Node.js 20+ and npm
- Enough disk space for uploaded files

## Run locally
Open a terminal in this project folder:

```bash
npm install
npm run dev
```

- React site: http://localhost:5173
- API health check: http://localhost:4000/api/health
- Uploaded files are saved to `server/uploads/`; media metadata is saved to `server/data/media.json`.

## Upload limits
The Express/Multer server is configured for a maximum of 2 GiB per file (2,147,483,648 bytes). This does **not** mean the host has 2 GB of storage available. Large uploads require a server, reverse proxy, and hosting/storage provider that permit large request bodies and long upload times. For example, typical serverless hosting functions have request-size/time limits and are not suitable for receiving 2 GB uploads directly. Use a persistent server or direct-to-object-storage multipart uploads for production.

For Nginx, configure a sufficiently large `client_max_body_size` (e.g. `client_max_body_size 2100m;`) and suitable proxy timeouts. Your provider may impose its own limits.

## Production build
```bash
npm run build
npm start
```
The Express server serves `client/dist` when the frontend has been built.

## Important
- Only upload media you own or have permission to distribute.
- This starter has no user accounts, moderation, virus scanning, or access control. Do not expose it publicly until you add authentication, authorization, quotas, and abuse protection.
- Local disk storage is suitable for development/single-server use. Use persistent/object storage for production deployments.
