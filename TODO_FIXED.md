# Vercel Multer EROFS Fix - TODO

## 1. Edit src/routes/uploadRoutes.js ✅ Next
- multer.memoryStorage()
- req.file.buffer → ftpService.uploadBuffer()
- Remove fs.unlink/temp paths

## 2. Test local uploads
node src/index.js
curl -X POST http://localhost:4101/api/upload/secretebase/file -F "files=@test.jpg"

## 3. Deploy & Test
npx vercel --prod
https://your-app.vercel.app/health

## Completed:

