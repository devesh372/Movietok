import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body || {};

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "Session security is not configured" });
  }

  const token = crypto
    .createHmac("sha256", secret)
    .update("MOVIETOK_ADMIN")
    .digest("hex");

  res.setHeader(
    "Set-Cookie",
    `movietok_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`
  );

  return res.status(200).json({ success: true });
}
