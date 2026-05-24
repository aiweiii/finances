import { Pool, types } from "pg";

types.setTypeParser(1082, (val: string) => val);

const pool = new Pool({
  connectionString: process.env.DB_DSN,
});

pool.on("connect", (client) => {
  client.query("SET timezone = 'Asia/Singapore'");
});

export default pool;
