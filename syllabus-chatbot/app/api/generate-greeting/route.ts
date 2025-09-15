import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY

  // Generate contextual fallback greetings based on time and day
  const currentTime = new Date()
  const hour = currentTime.getHours()
  const dayOfWeek = currentTime.toLocaleDateString("en-US", { weekday: "long" })
  const month = currentTime.toLocaleDateString("en-US", { month: "long" })

  const generateFallbackGreeting = () => {
    let contextualGreetings = []

    // Time-based greetings
    if (hour >= 23 || hour <= 5) {
      contextualGreetings = [
        "Studying late tonight?",
        "Working on something urgent?",
        "Need help with that assignment?",
        "Cramming for tomorrow?",
        "What's keeping you up?",
        "It's late. Need help?"
      ]
    } else if (hour >= 6 && hour < 9) {
      contextualGreetings = [
        "Ready for the day?",
        "Morning study session?",
        "What's on your agenda?",
        "Early bird studying?",
        "Got morning classes?",
      ]
    } else if (hour >= 17 && hour < 21) {
      contextualGreetings = [
        "How was school today?",
        "Evening homework time?",
        "Need help with anything?",
        "Ready to tackle assignments?",
        "What's due tomorrow?",
      ]
    } else {
      contextualGreetings = [
        "What are you working on?",
        "Any homework today?",
        "Need help studying?",
        "Got questions for me?",
        "Ready to learn something?",
        "What subject today?",
        "Need assignment help?",
        "Hey, what ya' doing?",
      ]
    }

    // Day-based additions
    if (dayOfWeek === "Monday") {
      contextualGreetings.push("New week, new goals?", "Monday motivation needed?")
    } else if (dayOfWeek === "Friday") {
      contextualGreetings.push("Almost weekend time?", "Finishing strong today?")
    } else if (dayOfWeek === "Sunday") {
      contextualGreetings.push("Sunday study prep?", "Getting ready for the week?")
    }

    // Season-based additions
    if (month === "December" || month === "May") {
      contextualGreetings.push("Finals prep time?", "Ready for that exam?", "Study group session?")
    }

    return contextualGreetings[Math.floor(Math.random() * contextualGreetings.length)]
  }

  if (!apiKey) {
    return NextResponse.json({ greeting: generateFallbackGreeting() })
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-pro" })

    // Determine time context
    let timeContext = ""
    if (hour >= 6 && hour < 12) timeContext = "morning"
    else if (hour >= 12 && hour < 17) timeContext = "afternoon"
    else if (hour >= 17 && hour < 21) timeContext = "evening"
    else timeContext = "late night"

    // Determine likely student context
    let contextHint = ""
    if (dayOfWeek === "Sunday" || dayOfWeek === "Saturday") {
      contextHint = "weekend - might be relaxing or catching up on assignments"
    } else if (hour >= 22 || hour <= 5) {
      contextHint = "late night - possibly cramming for exams or working on urgent assignments"
    } else if (month === "December" || month === "May") {
      contextHint = "exam season - likely preparing for finals"
    } else if (dayOfWeek === "Monday") {
      contextHint = "start of school week - might have new assignments"
    } else {
      contextHint = "regular school day - normal study routine"
    }

    const prompt = `You are Syllabus, an AI study assistant. Generate a single, casual, friendly greeting question for a student. 

Context: It's ${timeContext} on a ${dayOfWeek} in ${month}. Student context: ${contextHint}.

Requirements:
- Keep it under 6 words
- Make it contextual to the time/situation
- Sound natural and conversational
- Don't use "Hello" or formal greetings
- Examples of good style: "Ready for that exam?", "What ya working on?", "Need help studying?", "Got homework tonight?"

Generate just the greeting question, nothing else:`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const greeting = response.text().trim().replace(/['"]/g, "")

    return NextResponse.json({ greeting })
  } catch (error) {
    console.error("Error generating greeting:", error)
    return NextResponse.json({ greeting: generateFallbackGreeting() })
  }
}
