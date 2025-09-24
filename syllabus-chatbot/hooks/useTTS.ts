import { useState, useRef, useEffect, useCallback } from "react"

interface SpeechOptions {
  voiceName?: string
  rate?: number
}

interface UseTTSReturn {
  voices: SpeechSynthesisVoice[]
  isSpeaking: boolean
  speak: (text: string, options?: SpeechOptions) => Promise<void>
  cancel: () => void
  supported: boolean
}

export function useTTS(): UseTTSReturn {
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Load available voices
  useEffect(() => {
    if (!supported) return

    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices()
      setVoices(availableVoices)
    }

    loadVoices()
    speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      speechSynthesis.onvoiceschanged = null
    }
  }, [supported])

  // Save settings to localStorage
  const saveTTSSettings = (voiceName?: string, rate?: number) => {
    const settings = {
      voiceName: voiceName || undefined,
      rate: rate || 1.0
    }
    localStorage.setItem('syllabus-tts-settings', JSON.stringify(settings))
  }

  // Load settings from localStorage
  const loadTTSSettings = () => {
    try {
      const saved = localStorage.getItem('syllabus-tts-settings')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Error loading TTS settings:', error)
    }
    return { voiceName: undefined, rate: 1.0 }
  }

  // Voice mapping for ChatGPT-style selection
  const getVoiceForCategory = (category: string) => {
    if (!voices.length) return null

    // Get voice scorer function for this category
    const getVoiceScore = (voice: SpeechSynthesisVoice) => {
      switch (category) {
        case 'Neutral':
          if (voice.name.includes('Google UK English Female')) return 10
          if (voice.name.includes('Microsoft Zira')) return 8
          if (voice.lang.includes('en-GB') && voice.name.toLowerCase().includes('female')) return 6
          if (voice.name.includes('Microsoft Susan')) return 4
          if (voice.lang.startsWith('en-')) return 2
          return 0

        case 'Friendly':
          if (voice.name.includes('Google US English')) return 10
          if (voice.name.includes('Microsoft Hazel')) return 9
          if (voice.lang.includes('en-US')) return 7
          if (voice.name.includes('Google UK English Female')) return 5
          if (voice.lang.startsWith('en-')) return 2
          return 0

        case 'Professional':
          if (voice.name.includes('Microsoft Zira')) return 10
          if (voice.name.includes('Google UK English Female')) return 9
          if (voice.name.includes('Microsoft Susan')) return 7
          if (voice.lang.includes('en-GB') && voice.name.toLowerCase().includes('female')) return 5
          if (voice.lang.startsWith('en-')) return 2
          return 0

        default:
          return voice.lang.startsWith('en-') ? 1 : 0
      }
    }

    // Find voice with highest score
    let bestVoice = voices[0]
    let bestScore = 0

    for (const voice of voices) {
      const score = getVoiceScore(voice)
      if (score > bestScore) {
        bestScore = score
        bestVoice = voice
      }
    }

    return bestVoice
  }

  const speak = useCallback(async (text: string, options?: SpeechOptions): Promise<void> => {
    if (!supported || !text.trim()) {
      return Promise.resolve()
    }

    // Cancel any current speech
    cancel()

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text)

      // Apply voice settings
      const savedSettings = loadTTSSettings()
      const rate = options?.rate ?? savedSettings.rate ?? 1.0
      const voiceName = options?.voiceName ?? savedSettings.voiceName

      utterance.rate = Math.max(0.1, Math.min(10, rate))

      // Use voice mapping for categories, or direct voice name
      if (voiceName) {
        const selectedVoice = voices.find(voice => voice.name === voiceName) || getVoiceForCategory(voiceName)
        if (selectedVoice) {
          utterance.voice = selectedVoice
        }
      } else if (voices.length > 0) {
        // Default to Neutral voice category (Google UK English Female)
        utterance.voice = getVoiceForCategory('Neutral')
      }

      utterance.onstart = () => {
        setIsSpeaking(true)
      }

      utterance.onend = () => {
        setIsSpeaking(false)
        utterance.onstart = null
        utterance.onerror = null
        utterance.onend = null
        resolve()
      }

      utterance.onerror = (event) => {
        console.error('TTS error:', event.error)
        setIsSpeaking(false)
        utterance.onstart = null
        utterance.onerror = null
        utterance.onend = null
        reject(new Error(`Speech synthesis failed: ${event.error}`))
      }

      utterRef.current = utterance
      speechSynthesis.speak(utterance)

      // Save settings for next time
      saveTTSSettings(utterance.voice?.name, utterance.rate)
    })
  }, [supported, voices])

  const cancel = useCallback(() => {
    if (!supported) return

    speechSynthesis.cancel()
    setIsSpeaking(false)
    utterRef.current = null
  }, [supported])

  return {
    voices,
    isSpeaking,
    speak,
    cancel,
    supported
  }
}
