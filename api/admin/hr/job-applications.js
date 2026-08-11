import { ensureTables, hasDatabaseConfig, proxyToAuthoritative, query, requireBackendAdmin } from "../../_jobApplications.js";

export default async function handler(req, res) {
  if (!hasDatabaseConfig()) return proxyToAuthoritative(req, res);
  if (!(await requireBackendAdmin(req, res))) return;
  await ensureTables();

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
