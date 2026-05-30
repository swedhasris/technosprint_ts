import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { X, Minus, Sparkles, CheckSquare, List, PlusCircle, ArrowRight, ShieldAlert } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";

const firebaseAvailable = true;

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
                triggerBubble(`Ticket ${ticketNum} created successfully! I've noted it with care. 📝`);
                setPetState("ACTIVE");
              }
            } else if (change.type === "modified" && cachedStatus !== ticket.status) {
              if (ticket.status === "Resolved") {
                triggerBubble(`Good news! Ticket ${ticketNum} has been resolved! 🌟`);
                setPetState("RESOLVED");
              } else if (ticket.status === "Closed") {
                triggerBubble(`Ticket ${ticketNum} has been closed successfully. Great work! Zzz... 💤`);
                setPetState("CLOSED");
              } else if (ticket.status === "In Progress") {
                triggerBubble(`Work is currently underway on ticket ${ticketNum}! 🚀`);
                setPetState("IN_PROGRESS");
              } else if (ticket.status === "On Hold") {
                triggerBubble(`Ticket ${ticketNum} is temporarily on hold. ⏱`);
                setPetState("ON_HOLD");
              } else if (ticket.assignedTo === user.uid && cachedStatus !== "Assigned") {
                triggerBubble(`A technician has been assigned to ticket ${ticketNum}! 🔧`);
                setPetState("ASSIGNED");
              } else {
                triggerBubble(`Your ticket ${ticketNum} has been updated.`);
                setPetState("ACTIVE");
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
        if (status === "Resolved") setPetState("RESOLVED");
        else if (status === "Closed") setPetState("CLOSED");
        else if (status === "On Hold" || status === "Pending") setPetState("ON_HOLD");
        else if (status === "In Progress") setPetState("IN_PROGRESS");
        else if (status === "Assigned") setPetState("ASSIGNED");
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
        setPetState("PENDING");
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
        setPetState("WAVING");
        triggerBubble("Welcome back.");
      }
      
      if (idleTimer) clearTimeout(idleTimer);
      
      idleTimer = setTimeout(() => {
        // Go to sleep!
        isUserInactive = true;
        setPetState("SLEEPING");
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
            setPetState("WAVING");
          }, 3000);
        }
        return response;
      } catch (error) {
        if (taskName) {
          setPetState("ERROR");
          triggerBubble(`AI Task Failed: ${taskName} ⚠`);
          setTimeout(() => {
            setAiTask("");
            setPetState("WAVING");
          }, 3000);
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

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

  // Render official SVG Mascot based on current expression
  const renderMascotSVG = () => {
    // Symmetrical infinity loop branding logo path
    const logoPath = "M 0,0 C -4.5,-4.5 -9,-4.5 -9,0 C -9,4.5 -4.5,4.5 0,0 C 4.5,-4.5 9,-4.5 9,0 C 9,4.5 4.5,4.5 0,0 Z";

    // Map petState to one of the official derived visual states + WAITING/ERROR spec states
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

    const isHappy = visualState === "HAPPY";
    const isThinking = visualState === "THINKING";
    const isWriting = visualState === "WRITING";
    const isSleeping = visualState === "SLEEPING";
    const isCelebrating = visualState === "CELEBRATING";
    const isWorking = visualState === "WORKING";
    const isWaving = visualState === "WAVING";
    const isNotifying = visualState === "NOTIFYING";
    const isError = visualState === "ERROR";
    const isWaiting = visualState === "WAITING";

    return (
      <svg
        viewBox="0 0 100 100"
        className={`w-16 h-16 transition-all duration-300 drop-shadow-[0_4px_12px_rgba(0,102,255,0.35)]
          ${isDragging ? "scale-105 cursor-grabbing" : "cursor-grab"}`}
      >
        <defs>
          <linearGradient id="headGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#FAFCFF" />
            <stop offset="100%" stopColor="#D9E3F0" />
          </linearGradient>

          <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="40%" stopColor="#0066FF" />
            <stop offset="100%" stopColor="#0044CC" />
          </linearGradient>

          <linearGradient id="darkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          <radialGradient id="screenGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00D2FF" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#00D2FF" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="checkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style>{`
          @keyframes bob {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-4px); }
          }
          @keyframes shadow-scale {
            0%, 100% { transform: scale(1); opacity: 0.15; }
            50% { transform: scale(0.85); opacity: 0.08; }
          }
          @keyframes blink {
            0%, 90%, 100% { transform: scaleY(1); }
            95% { transform: scaleY(0.1); }
          }
          @keyframes zzz-rise {
            0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
            30% { opacity: 1; }
            70% { opacity: 0.8; }
            100% { opacity: 0; transform: translate(8px, -14px) scale(0.9); }
          }
          .bob-group { animation: bob 3.8s ease-in-out infinite; }
          .shadow-group { animation: shadow-scale 3.8s ease-in-out infinite; transform-origin: 50px 96px; }
          .blink-eye { animation: blink 4.5s linear infinite; transform-origin: 50% 47px; }
          .z1 { animation: zzz-rise 3s ease-in-out infinite; transform-origin: 75px 22px; }
          .z2 { animation: zzz-rise 3s ease-in-out infinite 1s; transform-origin: 79px 17px; }
          .z3 { animation: zzz-rise 3s ease-in-out infinite 2s; transform-origin: 83px 12px; }
          .neon-glow { filter: drop-shadow(0 0 1.5px #00E5FF) drop-shadow(0 0 3px rgba(0, 102, 255, 0.85)); }
        `}</style>

        <ellipse cx="50" cy="96" rx="18" ry="2.5" fill="rgba(0,102,255,0.15)" className="shadow-group" />

        <g className="bob-group">
          <g transform="translate(50, 18) rotate(30)">
            <rect x="-4" y="-14" width="8" height="15" rx="4" fill="url(#blueGrad)" stroke="#004CD0" strokeWidth="0.8" />
            <rect x="-2.5" y="-12" width="2" height="11" rx="1" fill="#FFFFFF" opacity="0.35" />
          </g>

          {isError && (
            <>
              {/* Red dome top light on the antenna */}
              <circle cx="50" cy="5" r="4.5" fill="#FF3333" className="neon-glow" filter="url(#glow)" />
              <circle cx="50" cy="5" r="3.2" fill="#FF8888" stroke="#FF0000" strokeWidth="0.8" />
            </>
          )}

          <circle cx="50" cy="46" r="28" fill="url(#headGrad)" stroke="#CAD5E2" strokeWidth="1" />
          <ellipse cx="38" cy="24" rx="9" ry="4.5" fill="#FFFFFF" opacity="0.25" transform="rotate(-28, 38, 24)" />

          <ellipse cx="20" cy="46" rx="5.5" ry="10.5" fill="url(#blueGrad)" stroke="#004CD0" strokeWidth="0.8" />
          <ellipse cx="21" cy="46" rx="2.4" ry="6.5" fill="#0035B0" />
          <g transform="translate(20.8, 46.2) scale(0.36) rotate(-10)">
            <path d={logoPath} stroke="#FFFFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <rect x="-6.2" y="-7.7" width="3.2" height="3.2" fill="#FFFFFF" transform="rotate(45, -4.6, -6.1)" />
          </g>

          <ellipse cx="80" cy="46" rx="5.5" ry="10.5" fill="url(#blueGrad)" stroke="#004CD0" strokeWidth="0.8" />
          <ellipse cx="79" cy="46" rx="2.4" ry="6.5" fill="#0035B0" />
          <g transform="translate(79.2, 46.2) scale(0.36) rotate(10)">
            <path d={logoPath} stroke="#FFFFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <rect x="-6.2" y="-7.7" width="3.2" height="3.2" fill="#FFFFFF" transform="rotate(45, -4.6, -6.1)" />
          </g>

          <rect x="24" y="26" width="52" height="39" rx="19.5" fill="#141E30" stroke="#0E1724" strokeWidth="1" />
          <rect x="25.5" y="27.5" width="49" height="36" rx="18" fill="url(#darkGrad)" />
          <ellipse cx="50" cy="45" rx="20" ry="14" fill="url(#screenGlow)" opacity="0.35" pointer-events="none" />
          <path d="M 26,34 Q 50,29 74,34 Q 74,31 50,26 Q 26,31 26,34 Z" fill="#FFFFFF" opacity="0.06" />

          <g transform="translate(50, 36) scale(0.68)" className="neon-glow" filter="url(#glow)">
            <path d={logoPath} stroke="#00E5FF" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <rect x="-6.2" y="-7.7" width="3" height="3" fill="#00E5FF" transform="rotate(45, -4.7, -6.2)" />
          </g>
          <g transform="translate(50, 36) scale(0.68)">
            <path d={logoPath} stroke="#FFFFFF" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <rect x="-6.2" y="-7.7" width="3" height="3" fill="#FFFFFF" transform="rotate(45, -4.7, -6.2)" />
          </g>

          {isSleeping ? (
            <>
              <g className="neon-glow" filter="url(#glow)">
                <path d="M 33,48 Q 38,51 43,48" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" />
                <path d="M 57,48 Q 62,51 67,48" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" />
              </g>
              <g>
                <path d="M 33,48 Q 38,51 43,48" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M 57,48 Q 62,51 67,48" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
              </g>
              <path d="M 47,53 Q 50,55 53,53" fill="none" stroke="#00E5FF" strokeWidth="2.2" strokeLinecap="round" className="neon-glow" filter="url(#glow)" />
              <path d="M 47,53 Q 50,55 53,53" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
            </>
          ) : isCelebrating ? (
            <>
              <g className="neon-glow" filter="url(#glow)">
                <path d="M 33,44 L 41,47 L 33,50" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 67,44 L 59,47 L 67,50" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <g>
                <path d="M 33,44 L 41,47 L 33,50" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 67,44 L 59,47 L 67,50" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <path d="M 46,52 Q 50,59 54,52 Z" fill="#00E5FF" className="neon-glow" filter="url(#glow)" />
              <path d="M 46,52 Q 50,59 54,52 Z" fill="#FFFFFF" />
            </>
          ) : isThinking ? (
            <>
              <g className="neon-glow" filter="url(#glow)">
                <path d="M 33,46 Q 38,41 43,46" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" />
                <path d="M 57,48 Q 62,48 67,48" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" />
              </g>
              <g>
                <path d="M 33,46 Q 38,41 43,46" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M 57,48 Q 62,48 67,48" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
              </g>
              <path d="M 45,54 Q 48,51 51,54 Q 53,56 55,53" fill="none" stroke="#00E5FF" strokeWidth="2.2" strokeLinecap="round" className="neon-glow" filter="url(#glow)" />
              <path d="M 45,54 Q 48,51 51,54 Q 53,56 55,53" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
            </>
          ) : isWriting ? (
            <>
              <g className="neon-glow" filter="url(#glow)">
                <path d="M 34,49 Q 39,46 44,51" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" />
                <path d="M 56,51 Q 61,46 66,49" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" />
              </g>
              <g>
                <path d="M 34,49 Q 39,46 44,51" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M 56,51 Q 61,46 66,49" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
              </g>
              <path d="M 47,55 Q 50,57 53,55" fill="none" stroke="#00E5FF" strokeWidth="2.2" strokeLinecap="round" className="neon-glow" filter="url(#glow)" />
              <path d="M 47,55 Q 50,57 53,55" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
            </>
          ) : isHappy ? (
            <>
              <g className="neon-glow" filter="url(#glow)">
                <path d="M 32,46 Q 38,39 44,46" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" className="blink-eye" />
                <path d="M 56,46 Q 62,39 68,46" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" className="blink-eye" />
              </g>
              <g>
                <path d="M 32,46 Q 38,39 44,46" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" className="blink-eye" />
                <path d="M 56,46 Q 62,39 68,46" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" className="blink-eye" />
              </g>
              <path d="M 45,52 Q 50,58 55,52 Z" fill="#00E5FF" className="neon-glow" filter="url(#glow)" />
              <path d="M 45,52 Q 50,58 55,52 Z" fill="#FFFFFF" />
            </>
          ) : isWorking ? (
            <>
              <g className="neon-glow" filter="url(#glow)">
                <path d="M 32,45 Q 38,40 44,47" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" />
                <path d="M 56,47 Q 62,40 68,45" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" />
              </g>
              <g>
                <path d="M 32,45 Q 38,40 44,47" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M 56,47 Q 62,40 68,45" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
              </g>
              <path d="M 45,54 Q 50,57 55,54" fill="none" stroke="#00E5FF" strokeWidth="2.5" strokeLinecap="round" className="neon-glow" filter="url(#glow)" />
              <path d="M 45,54 Q 50,57 55,54" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
            </>
          ) : isNotifying ? (
            <>
              <g>
                <path d="M 38,43 L 40,46 L 43,47 L 40,48 L 38,51 L 36,48 L 33,47 L 36,46 Z" fill="#00E5FF" className="neon-glow" filter="url(#glow)" />
                <path d="M 38,43 L 40,46 L 43,47 L 40,48 L 38,51 L 36,48 L 33,47 L 36,46 Z" fill="#FFFFFF" />
                <path d="M 62,43 L 64,46 L 67,47 L 64,48 L 62,51 L 60,48 L 57,47 L 60,46 Z" fill="#00E5FF" className="neon-glow" filter="url(#glow)" />
                <path d="M 62,43 L 64,46 L 67,47 L 64,48 L 62,51 L 60,48 L 57,47 L 60,46 Z" fill="#FFFFFF" />
              </g>
              <path d="M 46,53 Q 50,58 54,53 Z" fill="#00E5FF" className="neon-glow" filter="url(#glow)" />
              <path d="M 46,53 Q 50,58 54,53 Z" fill="#FFFFFF" />
            </>
          ) : isError ? (
            <>
              {/* ERROR (Yellow/orange warning eyes \ / and sad flat mouth) */}
              <g className="neon-glow" filter="url(#glow)">
                <path d="M 33,44 L 43,49" fill="none" stroke="#FFAA00" strokeWidth="3.2" strokeLinecap="round" />
                <path d="M 67,44 L 57,49" fill="none" stroke="#FFAA00" strokeWidth="3.2" strokeLinecap="round" />
              </g>
              <g>
                <path d="M 33,44 L 43,49" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M 67,44 L 57,49" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
              </g>
              {/* Sad flat mouth */}
              <path d="M 45,55 L 55,55" fill="none" stroke="#FFAA00" strokeWidth="2.5" strokeLinecap="round" className="neon-glow" filter="url(#glow)" />
              <path d="M 45,55 L 55,55" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
            </>
          ) : isWaiting ? (
            <>
              {/* WAITING (Standard blinking curved eyes looking left/right and neutral cute smile curve) */}
              <g className="neon-glow" filter="url(#glow)">
                <path d="M 31,48 Q 36,41 41,48" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" className="blink-eye" />
                <path d="M 59,48 Q 64,41 69,48" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" className="blink-eye" />
              </g>
              <g>
                <path d="M 31,48 Q 36,41 41,48" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" className="blink-eye" />
                <path d="M 59,48 Q 64,41 69,48" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" className="blink-eye" />
              </g>
              {/* Neutral cute smile curve */}
              <path d="M 46,54 Q 50,56 54,54" fill="none" stroke="#00E5FF" strokeWidth="2.5" strokeLinecap="round" className="neon-glow" filter="url(#glow)" />
              <path d="M 46,54 Q 50,56 54,54" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
            </>
          ) : (
            <>
              <g className="neon-glow" filter="url(#glow)">
                <path d="M 33,48 Q 38,41 43,48" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" className="blink-eye" />
                <path d="M 57,48 Q 62,41 67,48" fill="none" stroke="#00E5FF" strokeWidth="3.2" strokeLinecap="round" className="blink-eye" />
              </g>
              <g>
                <path d="M 33,48 Q 38,41 43,48" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" className="blink-eye" />
                <path d="M 57,48 Q 62,41 67,48" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" className="blink-eye" />
              </g>
              <path d="M 46,54 Q 50,58 54,54" fill="none" stroke="#00E5FF" strokeWidth="2.5" strokeLinecap="round" className="neon-glow" filter="url(#glow)" />
              <path d="M 46,54 Q 50,58 54,54" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
            </>
          )}

          <ellipse cx="50" cy="74.5" rx="10.5" ry="2.2" fill="#141E30" opacity="0.3" />

          <ellipse cx="50" cy="83" rx="16.5" ry="11" fill="url(#headGrad)" stroke="#CAD5E2" strokeWidth="1" />
          <g transform="translate(50, 83) scale(0.55)">
            <path d={logoPath} stroke="#0055FF" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <rect x="-6.2" y="-7.7" width="3" height="3" fill="#0055FF" transform="rotate(45, -4.7, -6.2)" />
          </g>

          {isWriting ? (
            <>
              <path d="M 28,82 C 34,81 34,76 38,77" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 27.5,82 C 26.5,83 27,84.5 28.5,85" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <circle cx="38" cy="77" r="2.2" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              <rect x="37" y="67" width="22" height="23" rx="2.5" fill="#1E293B" stroke="#00E5FF" strokeWidth="1.5" />
              <rect x="40" y="71" width="16" height="17" rx="1" fill="#FFFFFF" />
              <g transform="translate(48, 75) scale(0.3)">
                <path d={logoPath} stroke="#0055FF" strokeWidth="3.2" fill="none" strokeLinecap="round" />
                <rect x="-6.2" y="-7.7" width="3" height="3" fill="#0055FF" transform="rotate(45, -4.7, -6.2)" />
              </g>
              <line x1="43" y1="79" x2="53" y2="79" stroke="#CAD5E2" strokeWidth="1.2" />
              <line x1="43" y1="83" x2="50" y2="83" stroke="#CAD5E2" strokeWidth="1.2" />
              <path d="M 70,82 C 65,80 59,75 55,77" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 71.5,82 C 72.5,81 72,79.5 70.5,79" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <line x1="53" y1="71" x2="59" y2="79" stroke="#0055FF" strokeWidth="3.2" strokeLinecap="round" />
              <circle cx="53" cy="71" r="0.8" fill="#FFFFFF" />
            </>
          ) : isSleeping ? (
            <>
              <path d="M 28,82 Q 38,90 50,88" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 72,82 Q 62,90 50,88" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 27.5,82 C 26.5,83 27,84.5 28.5,85" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <path d="M 71.5,82 C 72.5,81 72,79.5 70.5,79" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <circle cx="50" cy="88" r="2.5" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              <g transform="translate(74, 20)">
                <text x="0" y="0" fill="#00C2FF" fontSize="7" fontWeight="black" fontFamily="monospace" className="z1">Z</text>
                <text x="4" y="-5" fill="#00E5FF" fontSize="5" fontWeight="bold" fontFamily="monospace" className="z2">z</text>
                <text x="8" y="-10" fill="#38BDF8" fontSize="4.2" fontWeight="bold" fontFamily="monospace" className="z3">z</text>
              </g>
            </>
          ) : isCelebrating ? (
            <>
              <path d="M 28,82 Q 16,74 20,62" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 72,82 Q 84,74 80,62" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 27.5,82 C 26.5,81 27,79.5 28.5,79" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <path d="M 71.5,82 C 72.5,81 72,79.5 70.5,79" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <circle cx="20" cy="62" r="2.2" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              <circle cx="80" cy="62" r="2.2" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              <g transform="translate(69, 18)">
                <circle cx="8" cy="8" r="8" fill="url(#checkGrad)" stroke="#FFFFFF" strokeWidth="1.5" />
                <path d="M 5,8 L 7,10 L 11,6" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </>
          ) : isThinking ? (
            <>
              <path d="M 28,82 C 22,85 24,91 26,95" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 27.5,82 C 26.5,83 27,84.5 28.5,85" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <circle cx="26" cy="95" r="2.2" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              <path d="M 72,82 Q 68,77 60,65" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 71.5,82 C 72.5,81 72,79.5 70.5,79" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <circle cx="60" cy="65" r="2.5" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
            </>
          ) : isWorking ? (
            <>
              <path d="M 28,82 Q 33,78 37,74" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 72,82 Q 67,78 63,74" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 27.5,82 C 26.5,83 27,84.5 28.5,85" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <path d="M 71.5,82 C 72.5,81 72,79.5 70.5,79" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <rect x="36" y="68" width="28" height="18" rx="2" fill="rgba(0,229,255,0.15)" stroke="#00E5FF" strokeWidth="1" className="neon-glow" filter="url(#glow)" />
              <g transform="translate(50, 77) scale(0.45)">
                <path d={logoPath} stroke="#00E5FF" strokeWidth="3.2" fill="none" strokeLinecap="round" />
                <rect x="-6.2" y="-7.7" width="3" height="3" fill="#00E5FF" transform="rotate(45, -4.7, -6.2)" />
              </g>
              <circle cx="37" cy="74" r="1.8" fill="#FFFFFF" />
              <circle cx="63" cy="74" r="1.8" fill="#FFFFFF" />
            </>
          ) : isNotifying ? (
            <>
              <path d="M 28,82 C 22,85 24,91 26,95" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 27.5,82 C 26.5,83 27,84.5 28.5,85" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <circle cx="26" cy="95" r="2.2" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              <path d="M 70,82 Q 78,76 78,68" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 71.5,82 C 72.5,81 72,79.5 70.5,79" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <g transform="translate(78, 68)">
                <path d="M -4,0 C -4,-2 -2,-4 0,-4 C 2,-4 4,-2 4,0 L 5,5 L -5,5 Z" fill="#00E5FF" className="neon-glow" filter="url(#glow)" />
                <circle cx="0" cy="7" r="1" fill="#00E5FF" />
                <circle cx="0" cy="1" r="6" stroke="#00E5FF" strokeWidth="0.8" fill="none" opacity="0.4" className="bob-group" />
              </g>
            </>
          ) : isError ? (
            <>
              {/* ERROR (Arms resting/worrying gesture at sides) */}
              {/* Left arm resting at side */}
              <path d="M 28,82 C 22,85 24,91 26,95" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="26" cy="95" r="2.2" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              {/* Solid blue wrapped cuffs on resting arm */}
              <path d="M 27.5,82 C 26.5,83 27,84.5 28.5,85" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <path d="M 24,91 C 23.5,92 24.5,93 25.5,94" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />

              {/* Right arm resting at side */}
              <path d="M 72,82 C 78,85 76,91 74,95" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="74" cy="95" r="2.2" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              {/* Solid blue wrapped cuffs on right resting arm */}
              <path d="M 71.5,82 C 72.5,83 72,84.5 70.5,85" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <path d="M 76,91 C 76.5,92 75.5,93 74.5,94" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
            </>
          ) : isWaiting ? (
            <>
              {/* WAITING (Right arm resting, left arm raised waiting/gesturing slightly) */}
              {/* Right arm resting at side */}
              <path d="M 28,82 C 22,85 24,91 26,95" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="26" cy="95" r="2.2" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              {/* Solid blue wrapped cuffs on resting arm */}
              <path d="M 27.5,82 C 26.5,83 27,84.5 28.5,85" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <path d="M 24,91 C 23.5,92 24.5,93 25.5,94" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />

              {/* Left arm raised slightly in a waiting pose */}
              <path d="M 72,82 Q 78,79 78,73" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="78" cy="73" r="2.2" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              {/* Solid blue wrapped cuffs on waving arm */}
              <path d="M 71.5,82 C 72.5,81 72,79.5 70.5,79" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <path d="M 28,82 C 22,85 24,91 26,95" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <circle cx="26" cy="95" r="2.2" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
              <path d="M 27.5,82 C 26.5,83 27,84.5 28.5,85" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <path d="M 72,82 Q 81,77 85,71" fill="none" stroke="url(#headGrad)" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M 71.5,82 C 72.5,81 72,79.5 70.5,79" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <path d="M 78.5,76.5 C 79.5,75.5 80.5,76.5 81.5,77.5" stroke="url(#blueGrad)" strokeWidth="5.5" strokeLinecap="round" fill="none" />
              <g transform="translate(85, 71)">
                <circle cx="0" cy="0" r="3" fill="#FFFFFF" stroke="#CAD5E2" strokeWidth="0.8" />
                <path d="M -1,-3 L -2,-6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M 1,-3 L 1,-7" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M 3,-2 L 4,-6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M 3,1 L 6.2,-0.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M -3,-1 L -5.8,-2" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
              </g>
            </>
          )}

        </g>
      </svg>
    );
  };

  // Sleeping Z's elements
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
          <span className="text-lg">🤖</span>
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
              <span className="text-xl">🤖</span>
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
