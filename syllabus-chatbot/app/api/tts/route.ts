import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set. Please check your environment variables.")
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

// OpenAI TTS voice mapping (Neutral, Friendly, Professional)
const voiceMap: Record<string, string> = {
  "Neutral": "alloy",
  "Friendly": "nova",
  "Professional": "alloy" // Alloy is neutral, but clearest for professional
}

export async function POST(request: NextRequest) {
  try {
    const { text, voice = "Neutral", speed = 1.0 } = await request.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    if (text.length > 4000) {
      return NextResponse.json({ error: "Text too long (max 4000 characters)" }, { status: 400 })
    }

    const openaiVoice = voiceMap[voice] || "alloy"

    // Call OpenAI TTS API
    const mp3 = await getOpenAI().audio.speech.create({
      model: "tts-1",
      voice: openaiVoice as any,
      input: text,
      speed: Math.max(0.25, Math.min(4.0, speed)), // Clamp between 0.25-4.0
      response_format: "mp3"
    })

    // Convert to base64
    const buffer = Buffer.from(await mp3.arrayBuffer())
    const base64Audio = `data:audio/mp3;base64,${buffer.toString("base64")}`

    return NextResponse.json({
      audioUrl: base64Audio,
      voice: openaiVoice,
      speed,
      duration: text.length * 0.1 // Rough estimate
    })

  } catch (error) {
    console.error("TTS error:", error)
    return NextResponse.json({
      error: "Failed to generate speech",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "TTS API endpoint - POST {text, voice: 'Neutral'|'Friendly'|'Professional', speed: 0.8-1.2} to generate speech",
    voices: {
      "alloy": "Neutral",
      "nova": "Friendly",
      "alloy (best)": "Professional"
    },
    docs: "https://platform.openai.com/docs/guides/text-to-speech"
  })
}
