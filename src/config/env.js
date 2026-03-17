import dotenv from "dotenv";

dotenv.config();

function readEnv(key, fallback = "") {
  const value = process.env[key];
  return value === undefined || value === null || value === "" ? fallback : value;
}

export const env = {
  host: readEnv("HOST", "localhost"),
  port: Number(readEnv("PORT", "4101")),
  nodeEnv: readEnv("NODE_ENV", "development"),
  cronSecret: readEnv("CRON_SECRET", ""),
  jwtSecret: readEnv("JWT_SECRET", "change-me"),
  jwtExpiresIn: readEnv("JWT_EXPIRES_IN", "7d"),
  corsOrigins: (() => {
    const defaults = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "http://192.168.29.13:5173",
      "https://app-dashboards.netlify.app"
    ];
    const envOrigins = readEnv("CORS_ORIGIN", "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const merged = new Set([...defaults, ...envOrigins]);
    return Array.from(merged);
  })(),
  mysql: {
   host: readEnv("MYSQL_HOST", "178.62.0.70"),
    port: Number(readEnv("MYSQL_PORT", "3306")),
    user: readEnv("MYSQL_USER", "jxahnsgymg"),
    password: readEnv("MYSQL_PASSWORD", "vStK6y6eD5"),
    database: readEnv("MYSQL_DATABASE", "jxahnsgymg"),
    connectTimeout: "100000",
    connectionLimit: 10,
    queueLimit: 0
  },
  sftp: {
    enabled:
      readEnv(
        "SFTP_ENABLED",
        readEnv("FTP_ENABLED", "true")
      ).toLowerCase() === "true",
 host: readEnv("FTP_HOST", "178.62.0.70"),
    port: Number(readEnv("FTP_PORT", "22")),
    user: readEnv("FTP_USER", "renish"),
    password: readEnv("FTP_PASSWORD", "UpgradeRenish@123"),
    basePath: readEnv(
      "SFTP_BASE_PATH",
      readEnv("FTP_BASE_PATH", "/public_html/modscraft/upload/data")
    )
  },
  localUploadBase: readEnv(
    "LOCAL_UPLOAD_BASE",
    "uploads/modscraft/upload/data"
  )
};
