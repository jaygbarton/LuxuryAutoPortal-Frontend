import {
  cleanFileName,
  cleanString,
  ensureTables,
  hasDatabaseConfig,
  query,
} from "../_jobApplications.js";

const AUTHORITATIVE_CHUNK_ENDPOINT = "https://luxury-auto-portal-frontend.vercel.app/api/job-application/document-chunk";

async function ensureChunkTable() {
  await ensureTables();
  await query(`
    CREATE TABLE IF NOT EXISTS job_application_document_chunks (
      upload_id VARCHAR(80) NOT NULL,
      job_application_id INT NOT NULL,
      field_name VARCHAR(80) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(160) NOT NULL,
      file_size INT NOT NULL,
      chunk_index INT NOT NULL,
      total_chunks INT NOT NULL,
      chunk_data LONGBLOB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (upload_id, chunk_index),
      KEY idx_job_application_document_chunks_application (job_application_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    if (!hasDatabaseConfig()) {
      const response = await fetch(AUTHORITATIVE_CHUNK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body || {}),
      });
      const payload = await response.json().catch(() => null);
      res.status(response.status).json(payload || { error: response.ok ? undefined : "Failed to save application document" });
      return;
    }

    const applicationId = Number(req.body?.applicationId);
    const uploadId = cleanString(req.body?.uploadId, 80);
    const fieldName = cleanString(req.body?.fieldName, 80);
    const originalName = cleanFileName(req.body?.originalName || fieldName);
    const mimeType = cleanString(req.body?.mimeType, 160) || "application/octet-stream";
    const fileSize = Number(req.body?.fileSize || 0);
    const chunkIndex = Number(req.body?.chunkIndex);
    const totalChunks = Number(req.body?.totalChunks);
    const chunkBase64 = String(req.body?.chunkBase64 || "");

    if (!Number.isFinite(applicationId) || applicationId <= 0 || !uploadId || !fieldName) {
      res.status(400).json({ error: "Missing document upload fields" });
      return;
    }
    if (!Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks) || chunkIndex < 0 || totalChunks < 1 || chunkIndex >= totalChunks) {
      res.status(400).json({ error: "Invalid document chunk" });
      return;
    }
    if (!chunkBase64) {
      res.status(400).json({ error: "Missing document chunk data" });
      return;
    }

    await ensureChunkTable();
    await query(
      `INSERT INTO job_application_document_chunks
        (upload_id, job_application_id, field_name, original_name, mime_type, file_size, chunk_index, total_chunks, chunk_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE chunk_data = VALUES(chunk_data)`,
      [
        uploadId,
        applicationId,
        fieldName,
        originalName,
        mimeType,
        fileSize,
        chunkIndex,
        totalChunks,
        Buffer.from(chunkBase64, "base64"),
      ],
    );

    const rows = await query(
      `SELECT chunk_index, chunk_data
       FROM job_application_document_chunks
       WHERE upload_id = ? AND job_application_id = ?
       ORDER BY chunk_index ASC`,
      [uploadId, applicationId],
    );

    if (rows.length < totalChunks) {
      res.status(200).json({ success: true, complete: false });
      return;
    }

    const existing = await query(
      `SELECT job_application_document_aid
       FROM job_application_documents
       WHERE job_application_id = ? AND field_name = ? AND original_name = ? AND file_size = ?
       LIMIT 1`,
      [applicationId, fieldName, originalName, fileSize],
    );

    if (!existing.length) {
      const buffer = Buffer.concat(rows.map((row) => Buffer.from(row.chunk_data)));
      await query(
        `INSERT INTO job_application_documents
          (job_application_id, field_name, original_name, mime_type, file_size, file_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [applicationId, fieldName, originalName, mimeType, fileSize || buffer.length, buffer],
      );
    }

    await query(
      `DELETE FROM job_application_document_chunks WHERE upload_id = ? AND job_application_id = ?`,
      [uploadId, applicationId],
    );

    res.status(201).json({ success: true, complete: true });
  } catch (error) {
    console.error("Vercel job application document chunk failed:", error);
    res.status(500).json({ error: "Failed to save application document" });
  }
}
