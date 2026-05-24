import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DB_DSN,
});

pool.on("connect", (client) => {
  client.query("SET timezone = 'Asia/Singapore'");
});

export default pool;
