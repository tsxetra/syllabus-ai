"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, MessageSquare, Settings, Send, X, Trash2, Moon, Sun } from "lucide-react"
import { motion, AnimatePresence, useAnimation } from "framer-motion"
import { filterProfanity } from "@/lib/profanity-filter"
import { ProfanityAlert } from "@/components/profanity-alert"

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

  // Profanity filtering state
  const [userProfanityAlert, setUserProfanityAlert] = useState<{ words: string[]; show: boolean }>({ words: [], show: false })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
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

      // Check for profanity in user input
      const filterResult = filterProfanity(currentInput.trim())
      if (filterResult.isBlocked) {
        setUserProfanityAlert({ words: filterResult.detectedWords, show: true })
        setTimeout(() => setUserProfanityAlert({ words: [], show: false }), 5000)
        if (inputRef.current) {
          inputRef.current.value = ""
        }
        setInput("")
        setIsTyping(false)
        return
      }

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

      {/* Profanity Alerts */}
      <AnimatePresence>
        {userProfanityAlert.show && (
          <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50">
            <ProfanityAlert
              blockedWords={userProfanityAlert.words}
              role="user"
              onDismiss={() => setUserProfanityAlert({ words: [], show: false })}
            />
          </div>
        )}
      </AnimatePresence>

      <motion.nav
        initial={{ x: -64, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-16 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 space-y-4 flex-shrink-0"
        aria-label="Main navigation"
      >
        {/* Logo with orb animation mask */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="w-10 h-10 flex items-center justify-center relative cursor-pointer"
          onClick={handleLogoClick}
        >
          <motion.div animate={logoOrbControls} className="relative w-8 h-8">
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400/30 to-green-600/30 blur-sm"
              animate={{
                opacity: logoOrbActive ? [0, 1, 0.5, 0] : 0,
                scale: logoOrbActive ? [0.5, 1.5, 1.8, 0.5] : 1,
              }}
              transition={{
                duration: logoOrbActive ? 1 : 0,
                repeat: logoOrbActive ? 0 : 0, // Only one loop
                ease: "easeInOut",
              }}
            />
            <motion.img
              src="/logo.png"
              alt="Syllabus AI Logo"
              className="w-8 h-8 object-contain relative z-10"
              style={{
                filter: logoOrbActive
                  ? "drop-shadow(0 0 12px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 24px rgba(22, 163, 74, 0.4))"
                  : "none",
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            />
          </motion.div>
        </motion.div>

        {/* Navigation Icons */}
        <div className="flex flex-col space-y-3 mt-8 leading-8">
          {[
            { Icon: Plus, label: "New conversation", onClick: handleNewConversation },
            { Icon: MessageSquare, label: "Chat history", onClick: handleChatHistory },
            { Icon: Settings, label: "Settings", onClick: handleSettings },
          ].map(({ Icon, label, onClick }, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index, duration: 0.3 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={label}
                onClick={onClick}
              >
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Icon className="w-5 h-5" />
                </motion.div>
              </Button>
            </motion.div>
          ))}
        </div>

        {/* User Avatar at bottom */}
        <div className="flex-1 flex items-end">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Avatar className="w-10 h-10">
              <AvatarImage src="/diverse-user-avatars.png" alt="User avatar" />
              <AvatarFallback className="bg-slate-900 text-white">U</AvatarFallback>
            </Avatar>
          </motion.div>
        </div>
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
                  <h4 className="font-medium mb-3">Model</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">AI Model</span>
                      <div className="flex gap-1">
                        {[
                          { key: "gpt-4", label: "GPT-4" },
                          { key: "gpt-3.5-turbo", label: "GPT-3.5" },
                        ].map(({ key, label }) => (
                          <Button
                            key={key}
                            variant={selectedModel === key ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedModel(key)}
                            className="text-xs"
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

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

              {/* Example prompts - ChatGPT style */}
              <motion.div variants={itemVariants} className="w-full max-w-4xl mx-auto space-y-4 mb-8 sm:mb-12">
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
                      transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className="p-4 sm:p-6 cursor-pointer bg-white dark:bg-slate-800 border-2 border-transparent hover:border-primary/20 transition-all duration-200 group"
                          onClick={() => {
                            setInput(prompt)
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
                        transition={{ delay: index * 0.1 }}
                        className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {message.role === "assistant" && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                            <Avatar className="w-8 h-8 bg-slate-900 flex-shrink-0">
                              <AvatarFallback className="bg-slate-900 text-white text-sm font-semibold">
                                S
                              </AvatarFallback>
                            </Avatar>
                          </motion.div>
                        )}
                        <motion.div
                          className={`max-w-[85%] sm:max-w-[80%] ${message.role === "user" ? "ml-auto" : ""}`}
                        >
                          {message.isBlocked ? (
                            <ProfanityAlert
                              blockedWords={message.blockedWords || []}
                              role={message.role}
                              inline
                              onDismiss={() => {}}
                            />
                          ) : (
                            <div className={`px-4 py-2 rounded-md ${message.role === "user" ? "bg-primary/10 text-foreground" : "text-muted-foreground"}`}>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                              <time className="text-xs opacity-60 mt-1 block" dateTime={message.timestamp.toISOString()}>
                                {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </time>
                            </div>
                          )}
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

        <motion.footer
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
          className="p-4 sm:p-6 border-t border-border bg-background/80 backdrop-blur-sm flex-shrink-0"
        >
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="relative">
              <Input
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                placeholder="Ask anything"
                className="w-full h-12 sm:h-14 pl-10 sm:pl-12 pr-16 sm:pr-20 text-sm sm:text-base bg-card border-2 border-border/50 rounded-2xl shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isLoading}
                aria-label="Chat input"
                maxLength={2000}
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
              <span>{input.length}/2000</span>
            </div>
          </form>
        </motion.footer>
      </main>
    </div>
  )
}
