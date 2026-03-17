import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2";

const db = mysql.createPool({
  connectTimeout: "10000",
  host:process.env.DB_HOST || "178.62.0.70" , // your MySQL host
  user: process.env.DB_USER || "jxahnsgymg", // your MySQL user
  password:process.env.DB_PASSWORD || "vStK6y6eD5", // your MySQL password
  database: process.env.DB_NAME || "jxahnsgymg", // your database name
  port:3306,
  connectionLimit: 10,
  charset: 'utf8mb4' ,
  // waitForConnections: true,
  // connectionLimit: 10,
  // queueLimit: 0
});
db.getConnection((err, connection) => {
if (err) {
console.error("Database connection error:", err);
throw err;
}
console.log("✅ MySQL Connected Successfully");
connection.release();
});

export default db;