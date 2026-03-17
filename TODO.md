# Vercel Serverless Fix - TODO List

## Status: In Progress

### 1. Create src/app.js ✅ Completed

Extract Express app setup from src/index.js:
- All middleware (cors, json, morgan, static)
- Health/root routes (/health, /api/ip, /)
- All route mounts
- Error handlers
- Export `default app`

### 2. Update src/index.js
- Import app from './app.js'
- Modify bootstrap(): connection tests + `if (!process.env.VERCEL) app.listen(...)`
- Keep bootstrap() call for local

### 3. Fix api/index.js
```js
import app from "../src/app.js";
export default app;
```

### 4. Test & Deploy
- Local: `npm run dev` or `node src/index.js` 
- Deploy: `vercel --prod`
- Test Vercel /health endpoint

## Completed Steps
- Create src/app.js

### 2. Update src/index.js ✅ Completed



