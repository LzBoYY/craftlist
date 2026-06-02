import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
const authHeader = req.headers.authorization;

if (!authHeader) {
  return res.status(401).json({ error: "Missing auth token" });
}

const token = authHeader.replace("Bearer ", "");

const {
  data: { user },
  error: userError
} = await supabase.auth.getUser(token);

if (userError || !user) {
  return res.status(401).json({ error: "Invalid user" });
}

const userId = user.id;
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
    console.log("TOKEN USAGE:", response.usage);
    const listing = JSON.parse(response.choices[0].message.content);
    const { error: insertError } = await supabase
  .from("generations")
  .insert({
    user_id: userId,
    item_name: itemName,
    title: listing.title,
    description: listing.description,
    price_range: listing.price_range,
    tags: listing.tags
  });

if (insertError) {
  console.error("Insert failed:", insertError);
}

   return res.status(200).json({
  listing
});

  } catch (error) {

    console.error("OPENAI ERROR:", error);

    return res.status(500).json({
      error: "AI request failed"
    });
  }
}
