// import app from "./app.js";
// import { env } from "./config/env.js";
// import { testDbConnection } from "./db/pool.js";
// import { testSftpConnection } from "./services/ftpService.js";

// async function bootstrap() {
//   try {
//     await testDbConnection();
//     await testSftpConnection();
//     app.listen(env.port, env.host, () => {
//       // eslint-disable-next-line no-console
//       console.log(`Backend running on http://${env.host}:${env.port}`);
//     });
//   } catch (error) {
//     // eslint-disable-next-line no-console
//     console.error("Failed to start backend:", error.message);
//     process.exit(1);
//   }
// }

// bootstrap();


// import express from "express";
// import cors from "cors";

// import { env } from "./config/env.js";
// import { testDbConnection } from "./db/pool.js";
// import { testSftpConnection } from "./services/ftpService.js";

// import modsRoutes from "./routes/modsRoutes.js";
// import uploadRoutes from "./routes/uploadRoutes.js";
// import searchkeywordRoutes from "./routes/searchkeywordRoutes.js";
// import categoryclicksRoutes from "./routes/categoryclicksRoutes.js";
// import analysisRoutes from "./routes/analysisRoutes.js";
// import dashboardRoutes from "./routes/dashboardRoutes.js";
// import authRoutes from "./routes/auth.routes.js"; 
// import { connectSFTP } from "./ftp.js";

// const app = express();

// /* -------------------- Middleware -------------------- */

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// /* -------------------- Root API -------------------- */

// app.get("/", (req, res) => {
//   return res.json("Server is running..");
// });

// /* -------------------- Routes -------------------- */
// app.use("/api/auth", authRoutes);  // ADD THIS
// app.use("/api/upload", uploadRoutes);
// app.use("/api/modanalysis", analysisRoutes);
// app.use("/api/categoryclicks", categoryclicksRoutes);
// app.use("/api/searchkeyword", searchkeywordRoutes);
// app.use("/api/mods", modsRoutes);
// app.use("/api", dashboardRoutes);


// async function bootstrap() {
//   try {
//     /* Test Database */
//     await testDbConnection();

//     /* Test SFTP (service version) */
//     await testSftpConnection();

//     /* Start Server */
//     app.listen(env.port, env.host, async () => {
//       console.log(`Backend running on http://${env.host}:${env.port}`);

//       /* Your original SFTP connection check */
//       try {
//         const sftp = await connectSFTP();
//         console.log("✅ SFTP Connected Successfully");
//         await sftp.end();
//       } catch (error) {
//         console.log("❌ SFTP Connection Failed:", error.message);
//       }
//     });

//   } catch (error) {
//     console.error("Failed to start backend:", error.message);
//     process.exit(1);
//   }
// }

// /* Start */
// bootstrap();


// /* -------------------- Bootstrap Server -------------------- */  




import { env } from "./config/env.js";
import { testDbConnection } from "./db/pool.js";
import { testSftpConnection } from "./services/ftpService.js";
import { connectSFTP } from "./ftp.js";

import authRoutes from "./routes/auth.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import modsRoutes from "./routes/mods.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import cronRoutes from "./routes/cron.routes.js";

import uploadRoutes from "./routes/uploadRoutes.js";
import searchkeywordRoutes from "./routes/searchkeywordRoutes.js";
import categoryclicksRoutes from "./routes/categoryclicksRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import sdashboardRoutes from "./routes/sdashboardRoutes.js";
import allmodsRoutes from "./routes/allmodsRoutes.js";


import app from "./app.js";







/* -------------------- Bootstrap -------------------- */

async function bootstrap() {
  try {
    // DB Check
    await testDbConnection();

    // SFTP Service Check
    await testSftpConnection();

    if (!process.env.VERCEL) {
      app.listen(env.port, env.host, async () => {
        console.log(`🚀 Backend running on http://${env.host}:${env.port}`);

        // Optional direct SFTP check
        try {
          const sftp = await connectSFTP();
          console.log("✅ SFTP Connected Successfully");
          await sftp.end();
        } catch (error) {
          console.log("❌ SFTP Connection Failed:", error.message);
        }
      });
    }

  } catch (error) {
    console.error("❌ Failed to start backend:", error.message);
    process.exit(1);
  }
}

/* -------------------- Start Server -------------------- */
bootstrap();