import { ensureTables, hasDatabaseConfig, proxyToAuthoritative, query, requireBackendAdmin } from "../../../../_jobApplications.js";

export default async function handler(req, res) {
  if (!hasDatabaseConfig()) return proxyToAuthoritative(req, res);
  if (!(await requireBackendAdmin(req, res))) return;
  if (req.method !== "GET") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }
  const documentId = Number(req.query.documentId);
  if (!Number.isFinite(documentId)) {
    res.status(400).json({ success: false, error: "Invalid document ID" });
    return;
  }
  await ensureTables();
  const docs = await query(
    `SELECT job_application_document_aid, original_name, mime_type, file_size, file_data
       FROM job_application_documents
      WHERE job_application_document_aid = ?
      LIMIT 1`,
    [documentId],
  );
  const doc = docs[0];
  if (!doc) {
    res.status(404).json({ success: false, error: "Document not found" });
    return;
  }
  res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.original_name)}"`);
  res.send(doc.file_data);
}
