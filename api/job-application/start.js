import {
  cleanString,
  ensureTables,
  query,
} from "../_jobApplications.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const data = {
      firstName: cleanString(req.body?.firstName, 80),
      lastName: cleanString(req.body?.lastName, 80),
      dateOfBirth: cleanString(req.body?.dateOfBirth, 30),
      position: cleanString(req.body?.position, 120),
      email: cleanString(req.body?.email, 255),
      phone: cleanString(req.body?.phone, 40),
      linkedin: cleanString(req.body?.linkedin, 300) || null,
      notes: cleanString(req.body?.notes, 2000) || null,
    };

    if (!data.firstName || !data.lastName || !data.dateOfBirth || !data.position || !data.email || !data.phone) {
      res.status(400).json({ error: "Missing required application fields" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    await ensureTables();
    const result = await query(
      `INSERT INTO job_applications
        (first_name, last_name, date_of_birth, position, email, phone, linkedin, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.firstName, data.lastName, data.dateOfBirth, data.position, data.email, data.phone, data.linkedin, data.notes],
    );

    res.status(201).json({
      success: true,
      applicationId: Number(result.insertId),
      message: "Application saved to HR Applications",
    });
  } catch (error) {
    console.error("Vercel job application start failed:", error);
    res.status(500).json({ error: "Failed to save application to HR Applications" });
  }
}
