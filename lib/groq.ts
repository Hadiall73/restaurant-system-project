import Groq from "groq-sdk";

export function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

// Schnelles, kostenloses Modell für Text
export const GROQ_MODEL = "llama-3.3-70b-versatile";
