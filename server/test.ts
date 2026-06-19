import * as dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
});

async function test() {
  const result = await genAI.models.generateContent({
    model: "gemma-4-31b-it",
    contents:
      'Is "Tennis" a real sport or athletic activity? Reply with only "yes" or "no".',
  });
  const text = result.text ?? "";
  console.log("Raw output:", text);
  console.log("Parsed:", text.trim().toLowerCase().startsWith("yes"));
}

test().catch(console.error);
