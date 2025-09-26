"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useSTT } from "@/hooks/useSTT"
import { useTTS } from "@/hooks/useTTS"
import { MicButton } from "@/components/MicButton"
import { VoiceWaveform } from "@/components/VoiceWaveform"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Plus, MessageSquare, Settings, Send, X, Trash2, Moon, Sun, Mic, Square, Volume2, VolumeX, Zap, EyeOff } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { motion, AnimatePresence, useAnimation } from "framer-motion"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  isBlocked?: boolean
  blockedWords?: string[]
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  lastActivity: Date
}

export default function SyllabusChat() {
  const { theme, setTheme } = useTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [contextualGreeting, setContextualGreeting] = useState("What are you working on?")
  const [isTyping, setIsTyping] = useState(false)
  const [showChatHistory, setShowChatHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showErrorPopup, setShowErrorPopup] = useState(false)

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState("gpt-4")

  const [logoOrbActive, setLogoOrbActive] = useState(false)
  const logoOrbControls = useAnimation()

  // Voice settings state - persisted in localStorage
  const [selectedVoice, setSelectedVoice] = useState<"Neutral" | "Friendly" | "Professional">("Neutral")
  const [speechSpeed, setSpeechSpeed] = useState(1.0)
  const [isMuted, setIsMuted] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState("")
  const [typingTextarea, setTypingTextarea] = useState("")
  const [isInputExpanded, setIsInputExpanded] = useState(false)
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null)
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // STT and TTS hooks
  const { supported: sttSupported, isListening, start: startSTT, stop: stopSTT } = useSTT()
  const { supported: ttsSupported, isSpeaking, speak } = useTTS()

  // Load voice settings from localStorage
  useEffect(() => {
    const savedVoiceSettings = localStorage.getItem("syllabus-voice-settings")
    if (savedVoiceSettings) {
      try {
        const settings = JSON.parse(savedVoiceSettings)
        setSelectedVoice(settings.selectedVoice || "Neutral")
        setSpeechSpeed(settings.speechSpeed || 1.0)
        setIsMuted(settings.isMuted || false)
      } catch (error) {
        console.error("Error loading voice settings:", error)
      }
    }
  }, [])

  // Save voice settings to localStorage
  const saveVoiceSettings = () => {
    localStorage.setItem("syllabus-voice-settings", JSON.stringify({
      selectedVoice,
      speechSpeed,
      isMuted,
    }))
  }

  // Update settings and save
  const updateSelectedVoice = (voice: typeof selectedVoice) => {
    setSelectedVoice(voice)
    setTimeout(saveVoiceSettings, 100)
  }

  const updateSpeechSpeed = (speed: number) => {
    setSpeechSpeed(speed)
    setTimeout(saveVoiceSettings, 100)
  }

  const updateIsMuted = (muted: boolean) => {
    setIsMuted(muted)
    setTimeout(saveVoiceSettings, 100)
  }

  // Handle voice input workflow
  const handleVoiceRecording = () => {
    if (!sttSupported) return

    setInterimTranscript("")
    startSTT({
      onInterimTranscript: (text) => {
        setInterimTranscript(text)
      },
      onFinalTranscript: async (text) => {
        setInterimTranscript("")
        await processVoiceInput(text)
      },
      onError: (error) => {
        console.error("STT error:", error)
        setInterimTranscript("")
      }
    })
  }

  const handleVoiceStop = () => {
    stopSTT()
    setInterimTranscript("")
  }

  const processVoiceInput = async (transcription: string) => {
    try {
      // Send transcribed text as user message
      const userMessage: Message = {
        id: Date.now().toString(),
        content: transcription,
        role: "user",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      // Get AI response
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      })

      const chatData = await chatResponse.json()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: chatData.content,
        role: "assistant",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Generate and play TTS audio
      if (!isMuted && ttsSupported) {
        try {
          await speak(chatData.content, {
            voiceName: selectedVoice,
            rate: speechSpeed,
          })
        } catch (ttsError) {
          console.error("TTS error:", ttsError)
        }
      }
    } catch (error) {
      console.error("Voice flow error:", error)
      // Fallback to error message
      const fallbackMessage: Message = {
        id: Date.now().toString(),
        content: "I couldn't process that voice input. Please try again or type your message.",
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, fallbackMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const orbControls = useAnimation()
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    generateContextualGreeting()
    loadChatSessions()
  }, [])

  const loadChatSessions = () => {
    try {
      const savedSessions = localStorage.getItem("syllabus-chat-sessions")
      if (savedSessions) {
        const sessions = JSON.parse(savedSessions).map((session: any) => ({
          ...session,
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
          lastActivity: new Date(session.lastActivity),
        }))
        setChatSessions(sessions)
      }
    } catch (error) {
      console.error("Failed to load chat sessions:", error)
    }
  }

  const saveCurrentSession = () => {
    if (messages.length === 0) return

    const sessionTitle = messages[0]?.content.slice(0, 50) + (messages[0]?.content.length > 50 ? "..." : "")
    const sessionId = currentSessionId || Date.now().toString()

    const session: ChatSession = {
      id: sessionId,
      title: sessionTitle,
      messages: messages,
      lastActivity: new Date(),
    }

    const updatedSessions = chatSessions.filter((s) => s.id !== sessionId)
    updatedSessions.unshift(session)

    setChatSessions(updatedSessions.slice(0, 50)) // Keep only last 50 sessions
    localStorage.setItem("syllabus-chat-sessions", JSON.stringify(updatedSessions.slice(0, 50)))
    setCurrentSessionId(sessionId)
  }

  const generateContextualGreeting = async () => {
    try {
      const response = await fetch('/api/generate-greeting', {
        method: 'POST',
      });
      const data = await response.json();
      setContextualGreeting(data.greeting);
    } catch (error) {
      console.error('Error fetching greeting:', error);
      // Fallback to local greetings
      const greetings = [
        "What are you working on?",
        "How can I help you today?",
        "What would you like to explore?",
        "Ready to dive into something new?",
        "What's on your mind?",
        "How can I assist with your studies?",
        "What topic interests you today?",
        "Ready to learn something exciting?",
      ];
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      setContextualGreeting(randomGreeting);
    }
  }

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setInput(value)

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Set typing state
      if (value.length > 0 && !isTyping) {
        setIsTyping(true)
      }

      // Clear typing state after delay
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false)
      }, 1000)
    },
    [isTyping],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      // Get the current input value directly from the ref
      const currentInput = inputRef.current?.value || input
      if (!currentInput.trim() || isLoading) return

      // Clear input immediately
      if (inputRef.current) {
        inputRef.current.value = ""
      }
      setInput("")
      setIsTyping(false)

      const userMessage: Message = {
        id: Date.now().toString(),
        content: currentInput.trim(),
        role: "user",
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.content,
          role: "assistant",
          timestamp: new Date(),
          isBlocked: data.isBlocked,
          blockedWords: data.blockedWords || []
        }

        setMessages((prev) => [...prev, assistantMessage])
      } catch (error) {
        console.error("Error:", error)
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
          role: "assistant",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      } finally {
        setIsLoading(false)
      }
    },
    [input, messages, isLoading],
  )

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isLoading])

  useEffect(() => {
    if (messages.length > 0) {
      saveCurrentSession()
    }
  }, [messages])

  // Typing effect for assistant messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === "assistant" && lastMessage.id !== typingMessageId) {
      setTypingMessageId(lastMessage.id)
      setTypingTextarea("")

      // Clear any existing typing interval
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current)
      }

      const content = lastMessage.content
      let charIndex = 0

      typingIntervalRef.current = setInterval(() => {
        setTypingTextarea((prev) => prev + content.charAt(charIndex))
        charIndex++

        if (charIndex >= content.length) {
          clearInterval(typingIntervalRef.current!)
          setTypingMessageId(null)
          typingIntervalRef.current = null
        }
      }, 30) // ~30ms per character (about 33 chars/second, natural reading speed)
    }
  }, [messages, typingMessageId])

  // Cleanup typing interval on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current)
      }
    }
  }, [])

  const handleNewConversation = () => {
    setMessages([])
    setCurrentSessionId(null)
    generateContextualGreeting()
  }

  const handleChatHistory = () => {
    setShowChatHistory(!showChatHistory)
    setShowSettings(false)
  }

  const handleSettings = () => {
    setShowSettings(!showSettings)
    setShowChatHistory(false)
  }

  const handlePlusClick = () => {
    setShowErrorPopup(true)
    setTimeout(() => setShowErrorPopup(false), 3000)
  }

  const loadChatSession = (session: ChatSession) => {
    setMessages(session.messages)
    setCurrentSessionId(session.id)
    setShowChatHistory(false)
  }

  const deleteChatSession = (sessionId: string) => {
    const updatedSessions = chatSessions.filter((s) => s.id !== sessionId)
    setChatSessions(updatedSessions)
    localStorage.setItem("syllabus-chat-sessions", JSON.stringify(updatedSessions))

    if (currentSessionId === sessionId) {
      setMessages([])
      setCurrentSessionId(null)
    }
  }



  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  }

  const messageVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
      },
    },
  }

  const handleLogoClick = () => {
    setLogoOrbActive(true)
    setTimeout(() => setLogoOrbActive(false), 1000)
    generateContextualGreeting()
  }

  return (
    <div className="h-screen w-screen bg-background flex overflow-hidden">
      <AnimatePresence>
        {showErrorPopup && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg"
          >
            This feature is in development
          </motion.div>
        )}
      </AnimatePresence>



      <motion.nav
        initial={{ x: -64, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col py-4 flex-shrink-0"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="px-3 mb-2"
        >
          <div className="w-8 h-8 flex items-center justify-center relative cursor-pointer">
            <motion.div animate={logoOrbControls} className="relative w-6 h-6">
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400/30 to-green-600/30 blur-sm"
                animate={{
                  opacity: logoOrbActive ? [0, 1, 0.5, 0] : 0,
                  scale: logoOrbActive ? [0.5, 1.5, 1.8, 0.5] : 1,
                }}
                transition={{
                  duration: logoOrbActive ? 1 : 0,
                  repeat: logoOrbActive ? 0 : 0,
                  ease: "easeInOut",
                }}
              />
              <motion.img
                src="/logo.png"
                alt="Syllabus AI Logo"
                className="w-6 h-6 object-contain relative z-10"
                style={{
                  filter: logoOrbActive
                    ? "drop-shadow(0 0 8px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 16px rgba(22, 163, 74, 0.4))"
                    : "none",
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogoClick}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Upgrade CTA */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="px-3 mb-4"
        >
          <Button
            variant="outline"
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={() => setShowErrorPopup(true)}
          >
            <Zap className="w-4 h-4 mr-2" />
            Get+
          </Button>
        </motion.div>

        {/* Navigation */}
        <div className="px-3 space-y-1 mb-4">
          {[
            { Icon: Plus, label: "New chat", onClick: handleNewConversation },
            { Icon: EyeOff, label: "Temporary chat", onClick: handleNewConversation },
            { Icon: MessageSquare, label: "Chat history", onClick: handleChatHistory },
            { Icon: Settings, label: "Settings", onClick: handleSettings },
          ].map(({ Icon, label, onClick }, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1, duration: 0.3 }}
            >
              <Button
                variant="ghost"
                className="w-full justify-start px-3 py-2 h-10 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onClick}
              >
                <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{label}</span>
                </motion.div>
              </Button>
            </motion.div>
          ))}
        </div>

        <div className="flex-1"></div>

        {/* Model Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.3 }}
          className="px-3 mb-4"
        >
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-full bg-card border-0 focus:ring-2 focus:ring-ring">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  GPT-4
                </div>
              </SelectItem>
              <SelectItem value="gpt-3.5-turbo">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  GPT-3.5
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* User Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="px-3 mb-2"
        >
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Avatar className="w-8 h-8">
              <AvatarImage src="/diverse-user-avatars.png" alt="User avatar" />
              <AvatarFallback className="bg-slate-900 text-white">U</AvatarFallback>
            </Avatar>
          </motion.div>
        </motion.div>
      </motion.nav>

      <AnimatePresence>
        {showChatHistory && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-80 bg-card border-r border-border flex flex-col flex-shrink-0"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Chat History</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowChatHistory(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {chatSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No previous conversations</p>
              ) : (
                <div className="space-y-2">
                  {chatSessions.map((session) => (
                    <div key={session.id} className="group relative">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-left h-auto p-3 hover:bg-muted"
                        onClick={() => loadChatSession(session)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{session.title}</p>
                          <p className="text-xs text-muted-foreground">{session.lastActivity.toLocaleDateString()}</p>
                        </div>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 w-6 h-6"
                        onClick={() => deleteChatSession(session.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-80 bg-card border-r border-border flex flex-col flex-shrink-0"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Settings</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Appearance</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Theme</span>
                      <div className="flex gap-1">
                        {[
                          { key: "light", icon: Sun },
                          { key: "dark", icon: Moon },
                          { key: "system", icon: null },
                        ].map(({ key, icon: Icon }) => (
                          <Button
                            key={key}
                            variant={theme === key ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTheme(key)}
                            className="capitalize"
                          >
                            {Icon && <Icon className="w-3 h-3 mr-1" />}
                            {key === "system" ? "auto" : key}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Voice</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Voice Style</span>
                      <div className="flex gap-1">
                        {[
                          { key: "Neutral", label: "Neutral" },
                          { key: "Friendly", label: "Friendly" },
                          { key: "Professional", label: "Professional" },
                        ].map(({ key, label }) => (
                          <Button
                            key={key}
                            variant={selectedVoice === key ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateSelectedVoice(key as typeof selectedVoice)}
                            className="text-xs"
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Speed</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">0.8x</span>
                        <Slider
                          value={[speechSpeed]}
                          onValueChange={(value) => updateSpeechSpeed(value[0])}
                          max={1.2}
                          min={0.8}
                          step={0.1}
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground">1.2x</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">TTS Output</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateIsMuted(!isMuted)}
                        className="w-8 h-8"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col min-w-0 h-full">
        <AnimatePresence mode="wait">
          {messages.length === 0 ? (
            <motion.div
              key="welcome"
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.95 }}
              variants={containerVariants}
              className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-16 sm:py-24 overflow-y-auto"
            >
              {/* Central ChatGPT-style Voice Orb */}
              <motion.div variants={itemVariants} className="relative mb-12 sm:mb-16">
                <motion.div
                  animate={orbControls}
                  whileHover={{ scale: 1.05 }}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full relative flex items-center justify-center cursor-pointer"
                  role="img"
                  aria-label="AI Assistant Orb"
                  onClick={() => generateContextualGreeting()}
                >
                  {/* Main orb */}
                  <motion.div
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-full relative overflow-hidden shadow-2xl"
                    style={{
                      background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    }}
                    animate={{
                      boxShadow: isTyping
                        ? [
                            "0 0 30px rgba(34, 197, 94, 0.4), 0 0 60px rgba(22, 163, 74, 0.3)",
                            "0 0 50px rgba(34, 197, 94, 0.6), 0 0 100px rgba(22, 163, 74, 0.4)",
                            "0 0 30px rgba(34, 197, 94, 0.4), 0 0 60px rgba(22, 163, 74, 0.3)",
                          ]
                        : [
                            "0 0 20px rgba(34, 197, 94, 0.3), 0 0 40px rgba(22, 163, 74, 0.2)",
                            "0 0 30px rgba(34, 197, 94, 0.4), 0 0 60px rgba(22, 163, 74, 0.3)",
                            "0 0 20px rgba(34, 197, 94, 0.3), 0 0 40px rgba(22, 163, 74, 0.2)",
                          ],
                    }}
                    transition={{
                      duration: isTyping ? 0.8 : 3,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                  >
                    {/* Animated gradient layers */}
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          "linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)",
                      }}
                      animate={{
                        rotate: [0, 360],
                      }}
                      transition={{
                        duration: 8,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "linear",
                      }}
                    />

                    {/* Inner glow */}
                    <motion.div
                      className="absolute inset-2 rounded-full"
                      style={{
                        background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)",
                      }}
                      animate={{
                        opacity: isTyping ? [0.2, 0.6, 0.2] : [0.1, 0.3, 0.1],
                        scale: isTyping ? [0.8, 1.1, 0.8] : [0.9, 1.05, 0.9],
                      }}
                      transition={{
                        duration: isTyping ? 1 : 2.5,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                    />

                    {/* Particle effects */}
                    {[...Array(6)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-white/60 rounded-full"
                        style={{
                          top: `${20 + Math.sin((i * 60 * Math.PI) / 180) * 30}%`,
                          left: `${50 + Math.cos((i * 60 * Math.PI) / 180) * 30}%`,
                        }}
                        animate={{
                          opacity: [0, 1, 0],
                          scale: [0.5, 1.5, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                          delay: i * 0.3,
                        }}
                      />
                    ))}
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* Welcome Text with AI-generated contextual greeting */}
              <motion.header variants={itemVariants} className="text-center mb-8 sm:mb-12">
                <motion.p
                  className="text-xl sm:text-3xl text-black dark:text-white font-semibold text-pretty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                >
                  {contextualGreeting}
                </motion.p>
              </motion.header>

              {/* ChatGPT-style Centered Input */}
              <motion.div variants={itemVariants} className="w-full max-w-2xl mx-auto">
                <AnimatePresence mode="wait">
                  {!isInputExpanded ? (
                    <motion.div
                      key="collapsed"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex justify-center mb-4"
                    >
                      <motion.button
                        onClick={() => setIsInputExpanded(true)}
                        className={`flex items-center gap-3 px-6 py-3 rounded-full bg-card border-2 border-border/50 hover:border-primary/50 transition-all duration-200 shadow-lg ${isTyping ? 'ring-2 ring-primary/50' : ''}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        aria-label="Open chat input"
                      >
                        <MessageSquare className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{input || "Ask anything..."}</span>
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="expanded"
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.95 }}
                      onSubmit={handleSubmit}
                      className="mb-8"
                    >
                      <motion.div
                        className="relative bg-card border-2 border-border/50 rounded-2xl shadow-xl focus-within:border-primary/50 transition-all duration-300"
                        animate={{
                          boxShadow: isTyping
                            ? "0 0 30px rgba(34, 197, 94, 0.3), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                            : "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                        }}
                      >
                        <textarea
                          ref={inputRef}
                          value={input}
                          onChange={handleInputChange}
                          placeholder="Ask anything..."
                          className="w-full h-12 pl-12 pr-20 pt-3 pb-3 text-sm bg-transparent border-0 resize-none overflow-auto focus:ring-0 focus:outline-none"
                          rows={1}
                          maxLength={25000}
                          style={{ minHeight: '3rem', maxHeight: '8rem' }}
                          autoFocus
                          onBlur={(e) => {
                            if (!input.trim()) {
                              setIsInputExpanded(false)
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground hover:text-foreground"
                          onClick={handlePlusClick}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50"
                            disabled={!input.trim() || isLoading}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              if (!input.trim()) {
                                setIsInputExpanded(false)
                              }
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                      <div className="flex justify-center mt-2 text-xs text-muted-foreground">
                        <span>{input.length}/25000</span>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Example prompts - ChatGPT style */}
              <motion.div variants={itemVariants} className="w-full max-w-4xl mx-auto space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 sm:px-0">
                  {[
                    "Explain the concept of photosynthesis in simple terms",
                    "Write a short story about a robot learning to paint",
                    "Help me understand quantum physics basics",
                    "Create a study schedule for math exam preparation",
                    "Generate 10 creative writing prompts for fantasy stories",
                    "Explain how neural networks work in machine learning",
                  ].map((prompt, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 + index * 0.1, duration: 0.5 }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className="p-4 sm:p-6 cursor-pointer bg-white dark:bg-slate-800 border-2 border-transparent hover:border-primary/20 transition-all duration-200 group"
                          onClick={() => {
                            setInput(prompt)
                            setIsInputExpanded(true)
                            setTimeout(() => handleSubmit({ preventDefault: () => {} } as any), 100)
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                            <div>
                              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                "{prompt}"
                              </p>
                              <p className="text-xs text-muted-foreground mt-2 group-hover:text-primary/80">
                                Click to start this conversation
                              </p>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-full min-h-0"
            >
              <section className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0" aria-label="Chat messages">
                <div className="max-w-4xl mx-auto space-y-4">
                  <AnimatePresence>
                    {messages.map((message, index) => (
                      <motion.div
                        key={message.id}
                        variants={messageVariants}
                        initial="hidden"
                        animate="visible"
                        exit={{ opacity: 0, x: message.role === "user" ? 20 : -20 }}
                        transition={{ delay: index * 0.1, duration: 0.3, ease: "easeOut" }}
                        className={`flex gap-3 mb-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                        style={{ marginTop: '1rem' }} /* ChatGPT spacing */
                      >
                        {message.role === "assistant" && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 + index * 0.1 }}>
                            <Avatar className="w-8 h-8 bg-primary/20 border border-border flex-shrink-0">
                              <AvatarFallback className="text-primary text-sm font-semibold">
                                S
                              </AvatarFallback>
                            </Avatar>
                          </motion.div>
                        )}
                        <motion.div
                          className={`max-w-[85%] sm:max-w-[70%] ${message.role === "user" ? "ml-auto" : ""}`}
                        >
                          <div className={`px-4 py-3 rounded-2xl ${message.role === "user" ? "bg-primary text-primary-foreground" : message.isBlocked ? "border border-orange-300 bg-orange-50 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-lg" : "text-muted-foreground"}`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {message.role === "assistant" && message.id === typingMessageId ? typingTextarea : message.content}
                            </p>
                            {!message.isBlocked && (
                              <time className="text-xs opacity-60 mt-2 block" dateTime={message.timestamp.toISOString()}>
                                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </time>
                            )}
                          </div>
                        </motion.div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 justify-start"
                    >
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                        <Avatar className="w-8 h-8 bg-slate-900 flex-shrink-0">
                          <AvatarFallback className="bg-slate-900 text-white text-sm font-semibold">S</AvatarFallback>
                        </Avatar>
                      </motion.div>
                      <div className="text-muted-foreground px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1" aria-label="Loading">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-2 h-2 bg-primary rounded-full"
                                animate={{
                                  y: [-2, -8, -2],
                                  opacity: [0.5, 1, 0.5],
                                }}
                                transition={{
                                  duration: 0.6,
                                  repeat: Number.POSITIVE_INFINITY,
                                  delay: i * 0.1,
                                  ease: "easeInOut",
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-sm">Thinking...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.length > 0 && (
          <motion.footer
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
            className="p-4 sm:p-6 border-t border-border bg-background/80 backdrop-blur-sm flex-shrink-0"
          >
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask anything (essays, long texts supported)"
                  className="w-full h-12 sm:h-14 pl-10 sm:pl-12 pr-16 sm:pr-20 pt-3 pb-3 text-sm sm:text-base bg-card border-2 border-border/50 rounded-2xl shadow-sm focus-visible:ring-2 focus-visible:ring-ring resize-none overflow-auto"
                  disabled={isLoading}
                  aria-label="Chat input"
                  rows={1}
                  maxLength={25000}
                  style={{ minHeight: '3rem', maxHeight: '12rem' }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground hover:text-foreground"
                  aria-label="Add attachment"
                  onClick={handlePlusClick}
                >
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <Plus className="w-4 h-4" />
                  </motion.div>
                </Button>
                <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 sm:w-8 sm:h-8 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      disabled={!input.trim() || isLoading}
                      aria-label="Send message"
                    >
                      <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                    </Button>
                  </motion.div>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                <span>Press Enter to send, Shift+Enter for new line</span>
                <span>{input.length}/25000</span>
              </div>
            </form>
          </motion.footer>
        )}

        {/* Floating Microphone Button */}
        <VoiceWaveform
          isRecording={isListening}
          interimTranscript={interimTranscript}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50"
        />
        <MicButton
          isRecording={isListening}
          isSupported={sttSupported}
          onPressStart={handleVoiceRecording}
          onPressEnd={handleVoiceStop}
          className="fixed bottom-6 right-6 z-40"
        />
      </main>
    </div>
  )
}
