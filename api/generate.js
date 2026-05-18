import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Simple in-memory request tracking
const requestMap = new Map();

// Basic spam detection
function isSpam(text) {
  return /^(.)\1+$/.test(text) ||
         text.replace(/[^a-zA-Z0-9]/g, "").length < 2;
}

export default async function handler(req, res) {

  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // Get client IP
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "unknown";

  // Simple cooldown rate limit
  const now = Date.now();
  const cooldown = 10000; // 10 seconds

  if (requestMap.has(ip)) {
    const lastRequest = requestMap.get(ip);

    if (now - lastRequest < cooldown) {
      return res.status(429).json({
        error: "Please wait before generating another listing"
      });
    }
  }

  requestMap.set(ip, now);

  const { itemName, condition, brand } = req.body;

  // Input validation
  if (!itemName || typeof itemName !== "string") {
    return res.status(400).json({
      error: "Valid item name is required"
    });
  }

  if (itemName.length > 120) {
    return res.status(400).json({
      error: "Item name too long"
    });
  }

  if (condition && condition.length > 60) {
    return res.status(400).json({
      error: "Condition too long"
    });
  }

  if (brand && brand.length > 60) {
    return res.status(400).json({
      error: "Brand too long"
    });
  }

  // Spam prevention
  if (isSpam(itemName)) {
    return res.status(400).json({
      error: "Invalid item name"
    });
  }

  // Logging
  console.log({
    ip,
    itemName,
    timestamp: new Date().toISOString()
  });

  // AI prompt
  const prompt = `
You are a marketplace listing assistant.

A client may type a product name slightly incorrectly.
Interpret the intended product as accurately as possible.

DO NOT invent impossible products.
DO NOT create fake technical specifications.
DO NOT create unrealistic pricing.

Keep descriptions concise and realistic.

Item Name: ${itemName}
Condition: ${condition || "Used - Good"}
Brand: ${brand || "Unknown"}

Return ONLY valid JSON in this exact structure:
{
  "title": "...",
  "description": "...",
  "price_range": "...",
  "tags": ["...", "..."]
}
`;

  try {

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 250
    });

    const text = response.choices[0].message.content;

    return res.status(200).json({
      listing: text
    });

  } catch (error) {

    console.error("OPENAI ERROR:", error);

    return res.status(500).json({
      error: "AI request failed"
    });
  }
}
