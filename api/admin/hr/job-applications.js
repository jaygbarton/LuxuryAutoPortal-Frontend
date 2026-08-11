import { ensureTables, hasDatabaseConfig, proxyToAuthoritative, query, requireBackendAdmin } from "../../_jobApplications.js";

function getString(value) {
  return typeof value === "string" ? value : "";
}

function getNumeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default async function handler(req, res) {
  if (!hasDatabaseConfig()) return proxyToAuthoritative(req, res);
  if (!(await requireBackendAdmin(req, res))) return;
  await ensureTables();

  if (req.method === "GET" && getString(req.query.action) === "documents") {
    const applicationId = getNumeric(req.query.id || req.query.applicationId);
    if (!applicationId) {
      res.status(400).json({ success: false, error: "Invalid application ID" });
      return;
    }

    const documents = await query(
      `SELECT
         job_application_document_aid,
         job_application_id,
         field_name,
         original_name,
         mime_type,
         file_size,
         uploaded_at
       FROM job_application_documents
       WHERE job_application_id = ?
       ORDER BY job_application_document_aid ASC`,
      [applicationId],
    );
    res.json({ success: true, documents });
    return;
  }

  if (req.method === "GET" && getString(req.query.action) === "download") {
    const documentId = getNumeric(req.query.documentId);
    if (!documentId) {
      res.status(400).json({ success: false, error: "Invalid document ID" });
      return;
    }

    const docs = await query(
      `SELECT
         job_application_document_aid,
         original_name,
         mime_type,
         file_size,
         file_data
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
    res.send(Buffer.from(doc.file_data));
    return;
  }

  if (req.method === "PATCH") {
    const applicationId = getNumeric(req.body?.id || req.query.id || req.query.applicationId);
    if (!applicationId) {
      res.status(400).json({ success: false, error: "Invalid application ID" });
      return;
    }

    const archived = req.body?.archived !== false;
    await query(
      `UPDATE job_applications
       SET is_archived = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE job_application_aid = ?`,
      [archived ? 1 : 0, archived ? "archived" : "reviewed", applicationId],
    );
    res.json({ success: true, message: archived ? "Application archived" : "Application restored" });
    return;
  }

  if (req.method === "DELETE") {
    const applicationId = getNumeric(req.body?.id || req.query.id || req.query.applicationId);
    if (!applicationId) {
      res.status(400).json({ success: false, error: "Invalid application ID" });
      return;
    }

    await query(`DELETE FROM job_application_documents WHERE job_application_id = ?`, [applicationId]);
    await query(`DELETE FROM job_applications WHERE job_application_aid = ?`, [applicationId]);
    res.json({ success: true, message: "Application deleted" });
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  const status = typeof req.query.status === "string" ? req.query.status : "all";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const includeArchived = req.query.includeArchived === "1" || req.query.includeArchived === "true";
  const where = [];
  const params = [];

  if (!includeArchived) where.push("a.is_archived = 0");
  if (status && status !== "all") {
    where.push("a.status = ?");
    params.push(status);
  }
  if (search) {
    const term = `%${search}%`;
    where.push("(a.first_name LIKE ? OR a.last_name LIKE ? OR a.email LIKE ? OR a.position LIKE ? OR a.phone LIKE ?)");
    params.push(term, term, term, term, term);
  }

  const applications = await query(
    `SELECT
       a.job_application_aid,
       a.first_name,
       a.last_name,
       a.date_of_birth,
       a.position,
       a.email,
       a.phone,
       a.linkedin,
       a.notes,
       a.status,
       a.is_archived,
       a.submitted_at,
       a.updated_at,
       COUNT(d.job_application_document_aid) AS document_count
     FROM job_applications a
     LEFT JOIN job_application_documents d ON d.job_application_id = a.job_application_aid
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY a.job_application_aid
     ORDER BY a.submitted_at DESC, a.job_application_aid DESC
     LIMIT 300`,
    params,
  );
  res.json({ success: true, applications });
}
