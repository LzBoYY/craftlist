import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { itemName, condition, brand } = req.body;

  if (!itemName) {
    return res.status(400).json({ error: "Item name is required" });
  }

  const prompt = `
  You are a marketplace listing expert.
  Create a concise listing for this item:
  Item Name: ${itemName}
  Condition: ${condition || "Used - Good"}
  Brand: ${brand || "Unknown"}

  Return a JSON object with:
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
      messages: [{ role: "user", content: prompt }]
    });

    const text = response.choices[0].message.content;
    res.status(200).json({ listing: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI request failed" });
  }
}
