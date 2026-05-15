import OpenAI from "openai";

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  console.log("KEY EXISTS:", !!process.env.OPENAI_API_KEY);

  res.status(200).json({
    keyExists: !!process.env.OPENAI_API_KEY
  });
}
}
