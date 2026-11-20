import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.SESSION_SECRET;
  const expectedToken = crypto
    .createHmac("sha256", secret || "")
    .update("MOVIETOK_ADMIN")
    .digest("hex");

  const cookies = req.headers.cookie || "";
  const match = cookies.match(/(?:^|;\s*)movietok_session=([^;]+)/);
  const suppliedToken = match ? match[1] : "";

  const valid =
    suppliedToken.length === expectedToken.length &&
    crypto.timingSafeEqual(
      Buffer.from(suppliedToken),
      Buffer.from(expectedToken)
    );

  if (!secret || !valid) {
    return res.status(401).json({ error: "Admin login required" });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({
      error: "Cloudinary environment variables are missing"
    });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "movietok";

  const signature = crypto
    .createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  return res.status(200).json({
    cloudName,
    apiKey,
    timestamp,
    folder,
    signature
  });
}
