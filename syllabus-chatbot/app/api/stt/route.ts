import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

// Initialize OpenAI client (expects OPENAI_API_KEY env var)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioBlob = formData.get("audio") as Blob

    if (!audioBlob) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 })
    }

    // Convert blob to File-like object for OpenAI
    const file = new File([audioBlob], "audio.webm", { type: "audio/webm" })

    // Call OpenAI Whisper API (gpt-4o-transcribe supports faster transcription)
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "gpt-4o-transcribe",
      response_format: "text", // Gets plain text response
    })

    return NextResponse.json({ transcription: transcription })

  } catch (error) {
    console.error("STT error:", error)
    return NextResponse.json({
      error: "Failed to transcribe audio",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "STT API endpoint - POST audio blob as FormData 'audio' field to transcribe",
    models: ["whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"],
    docs: "https://platform.openai.com/docs/guides/speech-to-text"
  })
}
