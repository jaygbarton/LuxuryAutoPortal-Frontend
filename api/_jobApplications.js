import mysql from "mysql2/promise";

const BACKEND_URL = "https://luxuryautoportal-replit-1.onrender.com";

const dbConfig = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 2,
  charset: "utf8mb4",
  timezone: "Z",
};

let pool;

export function getPool() {
  if (!pool) {
    for (const key of ["host", "user", "password", "database"]) {
      if (!dbConfig[key]) throw new Error(`Missing database config: ${key}`);
    }
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

export function hasDatabaseConfig() {
  return Boolean(dbConfig.host && dbConfig.user && dbConfig.password && dbConfig.database);
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

export async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS job_applications (
      job_application_aid INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(80) NOT NULL,
      last_name VARCHAR(80) NOT NULL,
      date_of_birth VARCHAR(30) NOT NULL,
      position VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      linkedin VARCHAR(300) NULL,
      notes TEXT NULL,
      status ENUM('new','reviewed','archived') NOT NULL DEFAULT 'new',
      is_archived TINYINT(1) NOT NULL DEFAULT 0,
      submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_job_applications_status (status),
      KEY idx_job_applications_archived (is_archived),
      KEY idx_job_applications_submitted (submitted_at),
      KEY idx_job_applications_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS job_application_documents (
      job_application_document_aid INT AUTO_INCREMENT PRIMARY KEY,
      job_application_id INT NOT NULL,
      field_name VARCHAR(80) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(160) NOT NULL,
      file_size INT NOT NULL,
      file_data LONGBLOB NOT NULL,
      uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_job_application_documents_application (job_application_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export function cleanString(value, max = 10000) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .replace(/&#/g, "")
    .replace(/&lt;/gi, "")
    .replace(/&gt;/gi, "")
    .trim()
    .slice(0, max);
}

export function cleanFileName(name) {
  return cleanString(name, 255).replace(/[^\w.\- ()]/g, "").trim() || "uploaded-document";
}

export async function requireBackendAdmin(req, res) {
  const cookie = req.headers.cookie || "";
  const authRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { cookie },
  });
  if (!authRes.ok) {
    res.status(401).json({ success: false, error: "Unauthorized - Admin access required" });
    return false;
  }
  const user = await authRes.json().catch(() => null);
  if (!user?.isAdmin && !user?.user?.isAdmin) {
    res.status(401).json({ success: false, error: "Unauthorized - Admin access required" });
    return false;
  }
  return true;
}
