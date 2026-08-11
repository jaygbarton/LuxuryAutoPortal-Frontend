import { ensureTables, hasDatabaseConfig, proxyToAuthoritative, query, requireBackendAdmin } from "../../../../_jobApplications.js";

export default async function handler(req, res) {
  if (!hasDatabaseConfig()) return proxyToAuthoritative(req, res);
  if (!(await requireBackendAdmin(req, res))) return;
  if (req.method !== "GET") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }
  const id = Number(req.query.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, error: "Invalid application ID" });
    return;
  }
  await ensureTables();
  const documents = await query(
    `SELECT job_application_document_aid, job_application_id, field_name,
            original_name, mime_type, file_size, uploaded_at
       FROM job_application_documents
      WHERE job_application_id = ?
      ORDER BY job_application_document_aid ASC`,
    [id],
  );
  res.json({ success: true, documents });
}
