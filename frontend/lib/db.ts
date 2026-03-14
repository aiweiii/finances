import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DB_DSN,
});

export default pool;
