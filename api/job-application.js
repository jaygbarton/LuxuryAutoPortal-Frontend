import formidable from "formidable";
import { createReadStream } from "node:fs";
import {
  cleanFileName,
  cleanString,
  ensureTables,
  hasDatabaseConfig,
  query,
} from "./_jobApplications.js";

const AUTHORITATIVE_APPLICATION_ENDPOINT = "https://luxury-auto-portal-frontend.vercel.app/api/job-application";

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req) {
  const form = formidable({
    multiples: true,
    maxFileSize: 15 * 1024 * 1024,
    maxFiles: 6,
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function fileToRecord(file, fallbackFieldName) {
  const f = first(file);
  if (!f) return null;
  const chunks = [];
  for await (const chunk of createReadStream(f.filepath)) {
    chunks.push(Buffer.from(chunk));
  }
  return {
    fieldName: f.originalFilename ? fallbackFieldName : fallbackFieldName,
    originalName: cleanFileName(f.originalFilename || fallbackFieldName),
    mimeType: f.mimetype || "application/octet-stream",
    size: Number(f.size || 0),
    buffer: Buffer.concat(chunks),
  };
}

async function forwardApplication(data, docs) {
  const form = new FormData();
  form.append("firstName", data.firstName);
  form.append("lastName", data.lastName);
  form.append("dateOfBirth", data.dateOfBirth);
  form.append("position", data.position);
  form.append("email", data.email);
  form.append("phone", data.phone);
  if (data.linkedin) form.append("linkedin", data.linkedin);
  if (data.notes) form.append("notes", data.notes);
  for (const doc of docs) {
    form.append(doc.fieldName, new Blob([doc.buffer], { type: doc.mimeType }), doc.originalName);
  }
  const response = await fetch(AUTHORITATIVE_APPLICATION_ENDPOINT, {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || "Forwarded application save failed");
  }
  return payload;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { fields, files } = await parseForm(req);
    const data = {
      firstName: cleanString(first(fields.firstName), 80),
      lastName: cleanString(first(fields.lastName), 80),
      dateOfBirth: cleanString(first(fields.dateOfBirth), 30),
      position: cleanString(first(fields.position), 120),
      email: cleanString(first(fields.email), 255),
      phone: cleanString(first(fields.phone), 40),
      linkedin: cleanString(first(fields.linkedin), 300) || null,
      notes: cleanString(first(fields.notes), 2000) || null,
    };

    if (!data.firstName || !data.lastName || !data.dateOfBirth || !data.position || !data.email || !data.phone) {
      res.status(400).json({ error: "Missing required application fields" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    const docs = [
      await fileToRecord(files.resume, "resume"),
      await fileToRecord(files.driversLicense, "driversLicense"),
      ...(await Promise.all((Array.isArray(files.optionalDocuments) ? files.optionalDocuments : files.optionalDocuments ? [files.optionalDocuments] : []).map((f) => fileToRecord(f, "optionalDocuments")))),
    ].filter(Boolean);

    if (docs.length < 2 || !docs.some((d) => d.fieldName === "resume") || !docs.some((d) => d.fieldName === "driversLicense")) {
      res.status(400).json({ error: "Resume and driver's license are required" });
      return;
    }

    if (!hasDatabaseConfig()) {
      const payload = await forwardApplication(data, docs);
      res.status(201).json(payload);
      return;
    }

    await ensureTables();
    const result = await query(
      `INSERT INTO job_applications
        (first_name, last_name, date_of_birth, position, email, phone, linkedin, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.firstName, data.lastName, data.dateOfBirth, data.position, data.email, data.phone, data.linkedin, data.notes],
    );
    const applicationId = Number(result.insertId);
    for (const doc of docs) {
      await query(
        `INSERT INTO job_application_documents
          (job_application_id, field_name, original_name, mime_type, file_size, file_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [applicationId, doc.fieldName, doc.originalName, doc.mimeType, doc.size || doc.buffer.length, doc.buffer],
      );
    }

    res.status(201).json({ success: true, message: "Application saved to HR Applications" });
  } catch (error) {
    console.error("Vercel job application save failed:", error);
    res.status(500).json({ error: "Failed to save application to HR Applications" });
  }
}
