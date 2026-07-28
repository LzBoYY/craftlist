import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple in-memory request tracking
const requestMap = new Map();

const cooldown = 3000; // 3 seconds
const hourlyLimit = 100;

const AMAZON_TAG = process.env.AMAZON_TAG;
const EBAY_CAMPAIGN_ID = process.env.EBAY_CAMPAIGN_ID;

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
 

  if (requestMap.has(ip)) {
    const lastRequest = requestMap.get(ip);

    if (now - lastRequest < cooldown) {
      return res.status(429).json({
        error: "Please wait before generating another listing"
      });
    }
  }

  requestMap.set(ip, now);
  setTimeout(() => {
  requestMap.delete(ip);
}, cooldown);

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

  const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("credits, currency")
  .eq("id", userId)
  .single();

  const oneHourAgo = new Date(
  Date.now() - 60 * 60 * 1000
).toISOString();

const { count, error: countError } = await supabase
  .from("generations")
  .select("*", {
    count: "exact",
    head: true
  })
  .eq("user_id", userId)
  .gte("created_at", oneHourAgo);

if (countError) {
  console.error(countError);
}

if (count >= hourlyLimit) {
  return res.status(429).json({
    error: "Hourly generation limit reached. Please try again later."
  });
}

if (profileError || !profile) {
  return res.status(400).json({ error: "Profile not found" });
}

if (profile.credits < 10) {
  return res.status(403).json({ error: "Not enough credits" });
}
  
  // AI prompt
 const prompt = `
You are an expert marketplace seller.

Create a professional listing that can be copied directly into Facebook Marketplace, eBay, or similar platforms.

Rules:
- Make the title attractive and search-friendly.
- Keep the title under 80 characters.
- Write a detailed description of approximately 150-250 words.
- Make the description persuasive but honest.
- Mention important selling points.
- Include a condition summary.
- Include a buyer-friendly closing sentence.
- Never invent specifications or accessories.
- If information is missing, stay generic instead of guessing.
- Avoid exaggerated claims.
- Always estimate a realistic second-hand marketplace price range.
- Use common market knowledge for similar products.
- Never return 0 for price_min or price_max unless the item has no resale value.

Item Name: ${itemName}
Condition: ${condition || "Used - Good"}
Brand: ${brand || "Unknown"}

Return ONLY valid JSON in this exact structure:

{
  "title": "...",
  "description": "...",
  "price_min": 0,
  "price_max": 0,
  "tags": ["...", "..."],
  "image_query": "..."
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
      max_tokens: 500
      
    });
    console.log("TOKEN USAGE:", response.usage);
    const listing = JSON.parse(response.choices[0].message.content);
    if (!listing.price_min || !listing.price_max) {
  listing.price_min = 10;
  listing.price_max = 50;
}

let priceRange =
  `$${listing.price_min} - $${listing.price_max}`;
    if (profile.currency === "EUR") {

  priceRange =
    `€${Math.round(listing.price_min * 0.87)} - €${Math.round(listing.price_max * 0.87)}`;

}

if (profile.currency === "GBP") {

  priceRange =
    `£${Math.round(listing.price_min * 0.74)} - £${Math.round(listing.price_max * 0.74)}`;

}
    const imageQuery = listing.image_query || listing.title;
const searchQuery = encodeURIComponent(listing.title);

const amazonLink = AMAZON_TAG
  ? `https://www.amazon.com/s?k=${searchQuery}&tag=${AMAZON_TAG}`
  : null;

const ebayLink = EBAY_CAMPAIGN_ID
  ? `https://www.ebay.com/sch/i.html?_nkw=${searchQuery}&campid=${EBAY_CAMPAIGN_ID}&customid=listcraft&toolid=10001`
  : null;
const imageResponse = await fetch(
  `https://api.pexels.com/v1/search?query=${encodeURIComponent(imageQuery)}&per_page=2`,
  {
    headers: {
      Authorization: process.env.PEXELS_API_KEY
    }
  }
);

const imageData = await imageResponse.json();

const images = imageData.photos.map(
  photo => photo.src.large
);
    const { error: insertError } = await supabase
  .from("generations")
  .insert({
    user_id: userId,
    item_name: itemName,
    title: listing.title,
    description: listing.description,
    price_range: priceRange,
    tags: listing.tags,
    images: images
  });

if (insertError) {
  console.error("Insert failed:", insertError);
}
const { error: updateError } = await supabase
  .from("profiles")
  .update({
    credits: profile.credits - 10
  })
  .eq("id", userId);

if (updateError) {
  console.error("Credit update failed:", updateError);
}
   listing.price_range = priceRange; 
   return res.status(200).json({
  listing,
  images,
  amazonLink,
  ebayLink
});

  } catch (error) {

    console.error("OPENAI ERROR:", error);

    return res.status(500).json({
      error: "AI request failed"
    });
  }
}
