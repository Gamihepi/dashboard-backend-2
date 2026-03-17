import mysql from "mysql2/promise";
import { env } from "../config/env.js";

let pool;

if (!global.mysqlPool) {
  global.mysqlPool = mysql.createPool(env.mysql);
}

pool = global.mysqlPool;

export { pool };

export async function testDbConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    console.log(
      `[DB] Connected (${env.mysql.host}:${env.mysql.port}) database=${env.mysql.database}`
    );
  } finally {
    connection.release();
  }
}