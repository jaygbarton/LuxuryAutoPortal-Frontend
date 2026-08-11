import { ensureTables, query, requireBackendAdmin } from "../../../../_jobApplications.js";

export default async function handler(req, res) {
  if (!(await requireBackendAdmin(req, res))) return;
  if (req.method !== "PATCH") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }
  const id = Number(req.query.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ success: false, error: "Invalid application ID" });
    return;
  }
  const archived = req.body?.archived !== false;
  await ensureTables();
  await query(
    `UPDATE job_applications
        SET is_archived = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE job_application_aid = ?`,
    [archived ? 1 : 0, archived ? "archived" : "reviewed", id],
  );
  res.json({ success: true, message: archived ? "Application archived" : "Application restored" });
}
