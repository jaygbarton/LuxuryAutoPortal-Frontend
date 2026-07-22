const BACKEND_URL = "https://luxuryautoportal-replit-1.onrender.com";

async function proxyBouncie(req, path) {
  const headers = {};
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  if (req.headers.authorization) headers.authorization = String(req.headers.authorization);

  return fetch(`${BACKEND_URL}${path}`, {
    method: "GET",
    headers,
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ success: false, error: "Method not allowed" });
    return;
  }

  try {
    const adminFleet = await proxyBouncie(req, "/api/bouncie/fleet-overview");
    const upstream = adminFleet.ok
      ? adminFleet
      : await proxyBouncie(req, "/api/bouncie/client-fleet");

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("content-type", upstream.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error?.message || "Failed to fetch Bouncie fleet",
    });
  }
}
