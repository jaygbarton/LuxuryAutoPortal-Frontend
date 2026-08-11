import { ensureTables, query, requireBackendAdmin } from "../../../../_jobApplications.js";

export default async function handler(req, res) {
  if (!(await requireBackendAdmin(req, res))) return;
  if (req.method !== "DELETE") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }
  const id = Number(req.query.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, error: "Invalid application ID" });
    return;
  }
  await ensureTables();
  await query(`DELETE FROM job_application_documents WHERE job_application_id = ?`, [id]);
  await query(`DELETE FROM job_applications WHERE job_application_aid = ?`, [id]);
  res.json({ success: true, message: "Application deleted" });
}
