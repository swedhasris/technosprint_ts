import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { X, Minus, Sparkles, CheckSquare, List, PlusCircle, ArrowRight, ShieldAlert } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { firebaseAvailable, db } from "../lib/firebase";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";

import { useActivityTracker } from "../contexts/ActivityTrackerContext";

type PetState = 
  | "HAPPY" 
  | "THINKING" 
  | "WRITING" 
  | "SLEEPING" 
  | "CELEBRATING" 
  | "WORKING" 
  | "WAVING" 
  | "NOTIFYING"
  | "ACTIVE" 
  | "PENDING" 
  | "ASSIGNED" 
  | "IN_PROGRESS" 
  | "ON_HOLD" 
  | "ON HOLD"
  | "RESOLVED" 
  | "CLOSED"
  | "IDLE"
  | "WAITING"
  | "SUCCESS"
  | "ERROR";

interface TicketData {
  id: string;
  ticket_number?: string;
  number?: string;
  title: string;
  status: string;
  priority: string;
  assignedTo?: string;
  createdBy?: string;
  updatedAt?: any;
}

export function TechnosprintPet() {
  const { user, profile } = useAuth();
  const { resolvedTheme } = useTheme();
  const location = useLocation();

  // Safe useActivityTracker call
  let trackerStatus = "stopped";
  try {
    const activityTracker = useActivityTracker();
    trackerStatus = activityTracker?.status || "stopped";
  } catch (e) {
    // Graceful fallback
  }
  const isTrackerOn = trackerStatus === "active";

  // AI Task state
  const [aiTask, setAiTask] = useState("");

  // Position & visibility states
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem("technosprint_pet_minimized") === "true";
  });
  const [isOpen, setIsOpen] = useState(false);

  // Active pet state & message
  const [petState, setPetState] = useState<PetState>("ACTIVE");
  const [bubbleText, setBubbleText] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const bubbleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live ticket data states
  const [userTickets, setUserTickets] = useState<TicketData[]>([]);
  const [recentActivity, setRecentActivity] = useState<TicketData[]>([]);
  const [counts, setCounts] = useState({ open: 0, pending: 0, assigned: 0, resolved: 0 });

  // Dragging offset references
  const dragStartRef = useRef({ x: 0, y: 0 });
  const petRef = useRef<HTMLDivElement | null>(null);

  // Ref to track loaded tickets to avoid duplicate notifications on startup
  const isInitializedRef = useRef(false);
  const ticketsCacheRef = useRef<Record<string, string>>({});

  const isDarkMode = resolvedTheme === "dark";

  // 1. Position persistence & initialization
  useEffect(() => {
    const savedX = localStorage.getItem("technosprint_pet_x");
    const savedY = localStorage.getItem("technosprint_pet_y");
    if (savedX && savedY) {
      setPosition({ x: parseInt(savedX, 10), y: parseInt(savedY, 10) });
    } else {
      // Default position: bottom right corner
      setPosition({ x: window.innerWidth - 120, y: window.innerHeight - 150 });
    }
  }, []);

  // 2. Fetch/Subscribe to user's tickets in real-time
  useEffect(() => {
    if (!user?.uid || !firebaseAvailable) return;

    const ticketsRef = collection(db, "tickets");
    
    // Subscribe to all tickets so we can calculate stats and detect local updates safely
    const unsubscribe = onSnapshot(ticketsRef, (snapshot) => {
      const allTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TicketData));
      
      // Filter user related tickets
      const mine = allTickets.filter(t => t.createdBy === user.uid || t.assignedTo === user.uid);
      setUserTickets(mine);

      // Compute counts
      const open = mine.filter(t => ["New", "Open", "Assigned"].includes(t.status)).length;
      const pending = mine.filter(t => ["Pending", "On Hold", "Waiting for Customer"].includes(t.status)).length;
      const assigned = mine.filter(t => t.assignedTo === user.uid && !["Resolved", "Closed"].includes(t.status)).length;
      const resolved = mine.filter(t => t.status === "Resolved").length;
      setCounts({ open, pending, assigned, resolved });

      // Recent Activity
      const sorted = [...mine].sort((a, b) => {
        const tA = a.updatedAt?.seconds || 0;
        const tB = b.updatedAt?.seconds || 0;
        return tB - tA;
      });
      setRecentActivity(sorted.slice(0, 3));

      // SMART NOTIFICATION ENGINE
      if (isInitializedRef.current) {
        snapshot.docChanges().forEach((change) => {
          const ticket = { id: change.doc.id, ...change.doc.data() } as TicketData;
          
          // Only notify if it's the user's ticket
          if (ticket.createdBy === user.uid || ticket.assignedTo === user.uid) {
            const ticketNum = ticket.ticket_number || ticket.number || "Incident";
            const cachedStatus = ticketsCacheRef.current[ticket.id];

            if (change.type === "added") {
              if (ticket.createdBy === user.uid) {
                // Play visual sequence for creation and submission
                triggerBubble(`Ticket ${ticketNum} created successfully! I've noted it with care. 📝`);
                setPetState("WRITING");
                setTimeout(() => {
                  setPetState("SUCCESS");
                }, 2000);
              }
            } else if (change.type === "modified" && cachedStatus !== ticket.status) {
              const priority = ticket.priority;
              
              if (priority?.includes("Critical")) {
                triggerBubble(`Warning: Critical incident ${ticketNum} has been updated! ⚠️`);
                setPetState("ALERT");
              } else if (ticket.status === "Resolved") {
                triggerBubble(`Good news! Ticket ${ticketNum} has been resolved! 🌟`);
                setPetState("RESOLVED");
              } else if (ticket.status === "Closed") {
                triggerBubble(`Ticket ${ticketNum} has been closed successfully. Great work! Zzz... 💤`);
                setPetState("CLOSED");
              } else if (ticket.status === "In Progress") {
                triggerBubble(`Work is currently underway on ticket ${ticketNum}! 🚀`);
                setPetState("WORKING");
              } else if (ticket.status === "On Hold") {
                triggerBubble(`Ticket ${ticketNum} is temporarily on hold. ⏱`);
                setPetState("ON_HOLD");
              } else if (ticket.assignedTo === user.uid && cachedStatus !== "Assigned") {
                triggerBubble(`A technician has been assigned to ticket ${ticketNum}! 🔧`);
                setPetState("WORKING");
              } else {
                triggerBubble(`Your ticket ${ticketNum} has been updated.`);
                setPetState("THINKING");
              }
            }
          }
        });
      }

      // Initialize cache
      const newCache: Record<string, string> = {};
      allTickets.forEach(t => {
        newCache[t.id] = t.status;
      });
      ticketsCacheRef.current = newCache;
      isInitializedRef.current = true;
    }, (error) => {
      console.warn("[Pet Context] Firestore listen error (non-fatal):", error);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Dynamic pet state mapping based on page location & active tickets
  useEffect(() => {
    // Determine context-based pet expressions
    const path = location.pathname;

    if (path.startsWith("/tickets/")) {
      // If viewing a specific ticket, try to match its status
      const ticketId = path.split("/").pop();
      const activeTicket = userTickets.find(t => t.id === ticketId);
      if (activeTicket) {
        const status = activeTicket.status;
        const priority = activeTicket.priority;

        if (priority?.includes("Critical")) {
          setPetState("ALERT");
          setBubbleText("This is a CRITICAL incident! High priority handling required!");
        } else if (status === "Resolved") setPetState("RESOLVED");
        else if (status === "Closed") setPetState("CLOSED");
        else if (status === "On Hold" || status === "Pending") setPetState("ON_HOLD");
        else if (status === "In Progress") setPetState("WORKING");
        else if (status === "Assigned") setPetState("WORKING");
        else setPetState("ACTIVE");
      }
    } else {
      // Default page contextual text
      if (path === "/my-dashboard" || path === "/") {
        setBubbleText("Welcome back! Here's your ticket overview.");
        setPetState("ACTIVE");
      } else if (path === "/tickets" && location.search.includes("action=create")) {
        setBubbleText("Need help creating a ticket?");
        setPetState("PENDING");
      } else if (path === "/tickets") {
        setBubbleText("Track and monitor your requests here.");
        setPetState("ACTIVE");
      } else if (path === "/kb") {
        setBubbleText("Search articles to resolve issues faster!");
        setPetState("SEARCHING");
      } else if (path === "/reports") {
        setBubbleText("View performance insights and SLA stats.");
        setPetState("ACTIVE");
      } else if (path === "/settings") {
        setBubbleText("Manage system preferences and branding.");
        setPetState("ACTIVE");
      } else {
        setBubbleText("Technosprint Pet is at your service! ⚡");
        setPetState("ACTIVE");
      }
      setShowBubble(true);
    }
  }, [location, userTickets]);

  // 3b. Idle Detection (5-minute inactivity tracker)
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let isUserInactive = false;
    const idleTimeoutMs = 5 * 60 * 1000; // 5 minutes

    const handleUserActivity = () => {
      if (isUserInactive) {
        // Wake up!
        isUserInactive = false;
        setPetState("ACTIVE");
        triggerBubble("Welcome back.");
      }
      
      if (idleTimer) clearTimeout(idleTimer);
      
      idleTimer = setTimeout(() => {
        // Go to sleep!
        isUserInactive = true;
        setPetState("WAITING");
        triggerBubble("I'm here whenever you need me.");
      }, idleTimeoutMs);
    };

    // Initialize timer
    handleUserActivity();

    // Listen to standard interaction events
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll", "click"];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, []);

  // 3c. Electron Floating Overlay control based on Tracker status
  useEffect(() => {
    if (isTrackerOn) {
      if ((window as any).electronAPI?.setAlwaysOnTop) {
        (window as any).electronAPI.setAlwaysOnTop(true);
      }
    } else {
      if ((window as any).electronAPI?.setAlwaysOnTop) {
        (window as any).electronAPI.setAlwaysOnTop(false);
      }
    }
  }, [isTrackerOn]);

  // 3d. Fetch request interceptor to detect real-time AI tasks
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async function (...args) {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url || "";
      let taskName = "";
      let taskState: PetState = "WORKING";

      if (url.includes("/api/ai/classify")) {
        taskName = "Analyzing ticket";
        taskState = "THINKING";
      } else if (url.includes("/api/ai/suggest")) {
        taskName = "Updating status";
        taskState = "WORKING";
      } else if (url.includes("/api/ai/chat")) {
        taskName = "Reviewing request";
        taskState = "WRITING";
      } else if (url.includes("/api/ai/analyze-activity") || url.includes("/api/ai/analyze-work")) {
        taskName = "Analyzing ticket";
        taskState = "THINKING";
      } else if (url.includes("/api/ai/generate-summary")) {
        taskName = "Generating report";
        taskState = "WORKING";
      } else if (url.includes("/api/ai/generate-notes")) {
        taskName = "Creating incident";
        taskState = "WRITING";
      }

      if (taskName) {
        setAiTask(taskName);
        setPetState(taskState);
        triggerBubble(`AI Task Started: ${taskName} ⚡`);
      }

      try {
        const response = await originalFetch.apply(this, args);
        if (taskName) {
          setPetState("CELEBRATING");
          triggerBubble(`AI Task Completed: ${taskName} ✓`);
          setTimeout(() => {
            setAiTask("");
            setPetState("ACTIVE");
          }, 3000);
        }
        return response;
      } catch (error) {
        if (taskName) {
          setPetState("ERROR");
          triggerBubble(`AI Task Failed: ${taskName} ⚠`);
          setTimeout(() => {
            setAiTask("");
            setPetState("ACTIVE");
          }, 3000);
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // 3e. Secure Browser Extension State Sync Bridge
  useEffect(() => {
    if (user?.uid) {
      window.postMessage({
        type: "TICKLORA_STATE_UPDATE",
        state: {
          role: profile?.role || "user",
          userName: profile?.name || "Technician",
          openTickets: counts.open,
          pendingTickets: counts.pending,
          assignedTickets: counts.assigned,
          resolvedTickets: counts.resolved,
          isTrackerOn: isTrackerOn,
          aiTask: aiTask,
          petState: petState,
          bubbleText: bubbleText
        }
      }, "*");
    }
  }, [user, profile, counts, isTrackerOn, aiTask, petState, bubbleText]);

  // 4. Trigger speech bubble helper
  const triggerBubble = (text: string) => {
    if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
    setBubbleText(text);
    setShowBubble(true);
    bubbleTimeoutRef.current = setTimeout(() => {
      setShowBubble(false);
    }, 6500);
  };

  // 5. Drag event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("a")) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newX = Math.max(10, Math.min(window.innerWidth - 110, e.clientX - dragStartRef.current.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 110, e.clientY - dragStartRef.current.y));
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem("technosprint_pet_x", String(position.x));
      localStorage.setItem("technosprint_pet_y", String(position.y));
    }
  }, [isDragging, position]);

  // Touch event handlers for mobile compatibility
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("a")) return;
    setIsDragging(true);
    const touch = e.touches[0];
    dragStartRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = Math.max(10, Math.min(window.innerWidth - 110, touch.clientX - dragStartRef.current.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 110, touch.clientY - dragStartRef.current.y));
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem("technosprint_pet_x", String(position.x));
      localStorage.setItem("technosprint_pet_y", String(position.y));
    }
  }, [isDragging, position]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove, { passive: false });
      window.addEventListener("touchend", handleTouchEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Minimize toggle helper
  const handleMinimizeToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMin = !isMinimized;
    setIsMinimized(newMin);
    setIsOpen(false);
    localStorage.setItem("technosprint_pet_minimized", String(newMin));
  };

  // Render official PNG Mascot based on current expression
  const renderMascotSVG = () => {
    const getVisualState = (state: PetState): "HAPPY" | "THINKING" | "WRITING" | "SLEEPING" | "CELEBRATING" | "WORKING" | "WAVING" | "NOTIFYING" | "ERROR" | "WAITING" => {
      switch (state) {
        case "HAPPY":
        case "SUCCESS":
          return "HAPPY";
        case "THINKING":
        case "PENDING":
        case "ON_HOLD":
        case "ON HOLD":
          return "THINKING";
        case "WRITING":
        case "ASSIGNED":
          return "WRITING";
        case "SLEEPING":
        case "CLOSED":
        case "IDLE":
          return "SLEEPING";
        case "CELEBRATING":
        case "RESOLVED":
          return "CELEBRATING";
        case "WORKING":
        case "IN_PROGRESS":
          return "WORKING";
        case "NOTIFYING":
          return "NOTIFYING";
        case "ERROR":
          return "ERROR";
        case "WAITING":
          return "WAITING";
        case "WAVING":
        case "ACTIVE":
        default:
          return "WAVING";
      }
    };

    const visualState = getVisualState(petState);
    const isSleeping = visualState === "SLEEPING";
    const isThinking = visualState === "THINKING";
    const isCelebrating = visualState === "CELEBRATING";
    const isWorking = visualState === "WORKING";
    const isError = visualState === "ERROR";

    const getPetImage = (state: string): string => {
      const normalized = String(state || "").toUpperCase();
      switch (normalized) {
        case "ACTIVE":
        case "WAVING":
        case "HAPPY":
          return "/assets/technosprint-pet/active.png";
        case "PENDING":
          return "/assets/technosprint-pet/pending.png";
        case "WORKING":
        case "IN_PROGRESS":
        case "ASSIGNED":
          return "/assets/technosprint-pet/working.png";
        case "WRITING":
          return "/assets/technosprint-pet/writing.png";
        case "THINKING":
          return "/assets/technosprint-pet/thinking.png";
        case "ASSISTING":
        case "NOTIFYING":
          return "/assets/technosprint-pet/assisting.png";
        case "SUCCESS":
          return "/assets/technosprint-pet/success.png";
        case "CELEBRATING":
        case "CELEBRATION":
          return "/assets/technosprint-pet/celebration.png";
        case "SEARCHING":
          return "/assets/technosprint-pet/searching.png";
        case "WAITING":
        case "IDLE":
        case "SLEEPING":
          return "/assets/technosprint-pet/waiting.png";
        case "CONCERNED":
          return "/assets/technosprint-pet/concerned.png";
        case "ALERT":
        case "ERROR":
          return "/assets/technosprint-pet/alert.png";
        case "ON_HOLD":
        case "ON HOLD":
          return "/assets/technosprint-pet/onhold.png";
        case "RESOLVED":
          return "/assets/technosprint-pet/resolved.png";
        case "CLOSED":
          return "/assets/technosprint-pet/closed.png";
        default:
          return "/assets/technosprint-pet/active.png";
      }
    };
    const petImageSrc = getPetImage(petState);

    // 3D perspective tilt per state
    const stateTilt: React.CSSProperties = (() => {
      switch (visualState) {
        case "SLEEPING": return { transform: "perspective(200px) rotateX(8deg) rotateY(4deg) rotateZ(6deg)" };
        case "THINKING": return { transform: "perspective(200px) rotateX(-4deg) rotateY(-6deg)" };
        case "CELEBRATING": return { transform: "perspective(200px) rotateX(-6deg) rotateY(3deg)" };
        case "WORKING": return { transform: "perspective(200px) rotateX(-3deg) rotateY(-3deg)" };
        case "ERROR": return { transform: "perspective(200px) rotateX(5deg) rotateY(5deg)" };
        default: return { transform: "perspective(200px) rotateX(-2deg) rotateY(0deg)" };
      }
    })();

    // State-based styles for the 3D pet image
    const stateStyle: React.CSSProperties = (() => {
      switch (visualState) {
        case "SLEEPING":
          return { filter: "brightness(0.6) saturate(0.5)", opacity: 0.85 };
        case "THINKING":
          return { filter: "hue-rotate(30deg) brightness(1.05)", opacity: 1 };
        case "CELEBRATING":
          return { filter: "brightness(1.3) saturate(1.6) drop-shadow(0 0 12px #22C55E)", opacity: 1 };
        case "WORKING":
          return { filter: "hue-rotate(-20deg) brightness(1.1) saturate(1.3)", opacity: 1 };
        case "ERROR":
          return { filter: "hue-rotate(140deg) brightness(1.1) saturate(1.4)", opacity: 1 };
        case "WRITING":
          return { filter: "brightness(1.05) saturate(1.2)", opacity: 1 };
        default:
          return { filter: "brightness(1.1) drop-shadow(0 0 10px rgba(0,102,255,0.5))", opacity: 1 };
      }
    })();

    const stateClass = (() => {
      if (isCelebrating) return "codex-pet-celebrate";
      if (isSleeping) return "codex-pet-sleep";
      if (isThinking || isWorking) return "codex-pet-think";
      return "codex-pet-float";
    })();

    return (
      <div
        className="relative"
        style={{
          filter: "drop-shadow(0 8px 16px rgba(0,80,255,0.35)) drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
          ...stateTilt,
          transition: "transform 0.6s cubic-bezier(0.34,1.56,0.64,1), filter 0.4s ease"
        }}
      >
        {/* 3D ambient halo */}
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-40 pointer-events-none transition-all duration-500"
          style={{
            background: isCelebrating
              ? "radial-gradient(circle, #22C55E 0%, transparent 70%)"
              : isError
              ? "radial-gradient(circle, #EF4444 0%, transparent 70%)"
              : isThinking
              ? "radial-gradient(circle, #F59E0B 0%, transparent 70%)"
              : "radial-gradient(circle, #3B82F6 0%, transparent 70%)",
            transform: "translateY(6px) scaleX(0.85)"
          }}
        />

        {/* Main 3D pet image */}
        <img
          src={petImageSrc}
          alt="Technosprint Pet"
          draggable={false}
          style={{
            ...stateStyle,
            filter: [
              stateStyle.filter,
              "drop-shadow(0 4px 8px rgba(0,60,200,0.4))",
              "drop-shadow(0 1px 2px rgba(0,0,0,0.5))"
            ].filter(Boolean).join(" ")
          }}
          className={`w-20 h-20 transition-all duration-500 select-none object-contain relative z-10 ${
            isDragging ? "scale-105 cursor-grabbing" : `cursor-grab ${stateClass}`
          }`}
        />

        {/* Glossy specular highlight overlay */}
        <div
          className="absolute top-1 left-2 w-8 h-5 rounded-full pointer-events-none z-20 opacity-20"
          style={{
            background: "radial-gradient(ellipse at 40% 30%, rgba(255,255,255,0.9), transparent 70%)",
            transform: "rotate(-15deg)"
          }}
        />

        {/* Ground glow */}
        <div
          className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-14 h-3 rounded-full blur-md opacity-50 transition-all duration-500 z-0"
          style={{
            background: isCelebrating
              ? "radial-gradient(ellipse, #22C55E, transparent)"
              : isError
              ? "radial-gradient(ellipse, #EF4444, transparent)"
              : isThinking
              ? "radial-gradient(ellipse, #F59E0B, transparent)"
              : "radial-gradient(ellipse, #3B82F6, transparent)"
          }}
        />

        {/* State indicator dot */}
        {(isCelebrating || isThinking || isWorking || isError) && (
          <span
            className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white animate-pulse z-30 ${
              isCelebrating ? "bg-green-400" :
              isError ? "bg-red-400" :
              isThinking ? "bg-amber-400" :
              "bg-blue-400"
            }`}
          />
        )}
      </div>
    );
  };

  const renderSleepZs = () => {
    return null;
  };

  return (
    <div
      ref={petRef}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 99999,
        touchAction: "none"
      }}
      className="flex flex-col items-center select-none"
    >
      {isTrackerOn && (
        <div className="absolute top-[-30px] bg-indigo-600/90 text-white text-[9px] px-2 py-0.5 rounded-full font-black animate-pulse shadow-md z-20 whitespace-nowrap flex items-center gap-1 border border-indigo-400/30">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-ping" />
          {aiTask ? `AI: ${aiTask}...` : "AI Companion Active"}
        </div>
      )}

      {/* Speech Bubble */}
      {showBubble && bubbleText && !isMinimized && (
        <div
          className={`absolute bottom-20 right-4 w-52 p-3 rounded-2xl shadow-xl text-xs leading-normal font-semibold transition-all duration-300 border animate-fade-in-up
            ${isDarkMode 
              ? "bg-[#151B26]/95 border-[#2d3748] text-white backdrop-blur-md" 
              : "bg-white/95 border-gray-100 text-gray-800 backdrop-blur-md"}`}
          style={{ transformOrigin: "bottom right" }}
        >
          <div className="flex justify-between items-start gap-1 mb-1 border-b border-border/40 pb-0.5">
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 animate-spin-slow" /> Technosprint Pet
            </span>
            <button onClick={() => setShowBubble(false)} className="text-gray-400 hover:text-red-500 font-bold leading-none">×</button>
          </div>
          <p className="whitespace-pre-wrap">{bubbleText}</p>
          <div
            className={`absolute bottom-[-6px] right-6 w-3 h-3 rotate-45 border-r border-b
              ${isDarkMode ? "bg-[#151B26] border-[#2d3748]" : "bg-white border-gray-100"}`}
          />
        </div>
      )}

      {/* Minimized Action Circle */}
      {isMinimized ? (
        <button
          onClick={handleMinimizeToggle}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 border-blue-500 transition-all hover:scale-105 active:scale-95 cursor-grab
            ${isDarkMode ? "bg-[#0B141A]" : "bg-white"}`}
          title="Click to restore Technosprint Pet"
        >
          <span className="scale-[0.72]">
            {renderMascotSVG()}
          </span>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
            +
          </span>
        </button>
      ) : (
        /* Full Mascot Body */
        <div
          className="relative flex flex-col items-center group"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="absolute top-[-20px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-1.5 bg-[#0B141A]/80 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10 z-10">
            <button
              onClick={handleMinimizeToggle}
              className="text-white hover:text-amber-500 transition-colors"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsOpen(prev => !prev)}
              className="text-white hover:text-blue-400 transition-colors"
              title="Open Panel"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-[-90deg]" />
            </button>
          </div>

          <div className="relative cursor-grab active:cursor-grabbing" onClick={() => setIsOpen(prev => !prev)}>
            {renderMascotSVG()}
            {renderSleepZs()}
          </div>
        </div>
      )}

      {/* Expanded Assistant Panel */}
      {isOpen && !isMinimized && (
        <div
          className={`absolute bottom-20 right-0 w-80 rounded-2xl shadow-2xl overflow-hidden border animate-fade-in-up
            ${isDarkMode 
              ? "bg-[#151B26]/95 border-[#2d3748] text-white backdrop-blur-md shadow-blue-500/5" 
              : "bg-white/95 border-gray-100 text-gray-800 backdrop-blur-md"}`}
          style={{ transformOrigin: "bottom right" }}
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <img src="/assets/technosprint-pet/active.png" alt="Pet" className="w-8 h-8 object-contain" style={{ filter: "drop-shadow(0 3px 6px rgba(0,80,255,0.5))", transform: "perspective(100px) rotateX(-4deg)" }} />
              <div>
                <h3 className="font-bold text-sm leading-none">Technosprint Pet</h3>
                <span className="text-[9px] opacity-80 uppercase tracking-widest font-black">AI Ticket Companion</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all font-bold text-xs"
            >
              ×
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5 animate-pulse" />
              <p className="font-medium text-blue-500 leading-relaxed">{bubbleText}</p>
            </div>

            {isTrackerOn && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs flex flex-col gap-1.5">
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                  Live AI Activity Status
                </span>
                <p className="font-bold text-xs text-indigo-400">
                  {aiTask ? `Currently: ${aiTask}` : "AI Engine is Idle / Waiting for Input"}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Open Tickets", value: counts.open, icon: List, color: "text-blue-500" },
                { label: "Pending Tickets", value: counts.pending, icon: ShieldAlert, color: "text-amber-500" },
                { label: "Assigned Tickets", value: counts.assigned, icon: CheckSquare, color: "text-indigo-500" },
                { label: "Resolved Tickets", value: counts.resolved, icon: CheckSquare, color: "text-emerald-500" }
              ].map((c, i) => (
                <div key={i} className={`p-2.5 rounded-xl border flex items-center gap-2.5
                  ${isDarkMode ? "bg-[#0B141A]/50 border-white/5" : "bg-gray-50 border-gray-100"}`}>
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                  <div>
                    <div className="text-[9px] text-muted-foreground uppercase font-black">{c.label}</div>
                    <div className="text-sm font-bold">{c.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Recent Ticket Activity</div>
              {recentActivity.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic pl-1">No ticket activity logged.</p>
              ) : (
                <div className="space-y-1.5">
                  {recentActivity.map((ticket) => {
                    const statusColors: Record<string, string> = {
                      New: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                      "In Progress": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
                      Resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
                      Closed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
                    };
                    const colorClass = statusColors[ticket.status] || "bg-muted text-muted-foreground";

                    return (
                      <Link
                        key={ticket.id}
                        to={`/tickets/${ticket.id}`}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center justify-between p-2 rounded-lg border text-[10px] font-medium transition-all hover:border-blue-500/50
                          ${isDarkMode ? "bg-[#0B141A]/30 border-white/5 hover:bg-[#0B141A]/60" : "bg-white border-gray-100 hover:bg-gray-50"}`}
                      >
                        <span className="truncate max-w-[140px] font-bold">
                          #{ticket.ticket_number || ticket.number || "INC"} - {ticket.title}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-black text-[8px] uppercase ${colorClass}`}>
                          {ticket.status}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className={`p-3 border-t flex flex-wrap gap-1.5 justify-center
            ${isDarkMode ? "border-white/5 bg-[#0B141A]/50" : "border-gray-100 bg-gray-50"}`}>
            {[
              { label: "Create Ticket", path: "/tickets?action=create", icon: PlusCircle },
              { label: "My Tickets", path: "/tickets", icon: List },
              { label: "Dashboard", path: "/my-dashboard", icon: Sparkles },
              { label: "Knowledge Base", path: "/kb", icon: Sparkles }
            ].map((act, i) => (
              <Link
                key={i}
                to={act.path}
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-bold transition-all hover:scale-[1.02] shadow-sm"
              >
                <act.icon className="w-2.5 h-2.5" />
                {act.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
