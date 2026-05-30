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
    const logoPath = "M 0,0 C -4.6,-4.6 -9.2,-4.6 -9.2,0 C -9.2,4.6 -4.6,4.6 0,0 C 4.6,-4.6 9.2,-4.6 9.2,0 C 9.2,4.6 4.6,4.6 0,0 Z";

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
    const isThinking = visualState === "THINKING";
    const isSleeping = visualState === "SLEEPING";
    const isCelebrating = visualState === "CELEBRATING";
    const isWorking = visualState === "WORKING" || visualState === "WRITING";
    const isError = visualState === "ERROR";
    const isWaiting = visualState === "WAITING";
    const isWaving =
      visualState === "WAVING" ||
      visualState === "HAPPY" ||
      visualState === "NOTIFYING" ||
      visualState === "CELEBRATING";

    const renderFace = () => {
      if (isSleeping) {
        return (
          <>
            <path d="M 37 50 C 40 45, 44 45, 47 50" fill="none" stroke="#35C8FF" strokeWidth="3.8" strokeLinecap="round" filter="url(#glow)" />
            <path d="M 53 50 C 56 45, 60 45, 63 50" fill="none" stroke="#35C8FF" strokeWidth="3.8" strokeLinecap="round" filter="url(#glow)" />
            <path d="M 46 59 C 48 61, 52 61, 54 59" fill="none" stroke="#35C8FF" strokeWidth="3.2" strokeLinecap="round" filter="url(#glow)" />
          </>
        );
      }

      if (isThinking) {
        return (
          <>
            <circle cx="40" cy="48" r="2.8" fill="#35C8FF" filter="url(#glow)" />
            <path d="M 54 49 C 57 44, 61 44, 64 49" fill="none" stroke="#35C8FF" strokeWidth="3.6" strokeLinecap="round" filter="url(#glow)" />
            <path d="M 46 58 C 48 57, 52 57, 54 58" fill="none" stroke="#35C8FF" strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />
          </>
        );
      }

      if (isError) {
        return (
          <>
            <path d="M 36 45 L 42 51" stroke="#35C8FF" strokeWidth="3.2" strokeLinecap="round" filter="url(#glow)" />
            <path d="M 42 45 L 36 51" stroke="#35C8FF" strokeWidth="3.2" strokeLinecap="round" filter="url(#glow)" />
            <path d="M 58 45 L 64 51" stroke="#35C8FF" strokeWidth="3.2" strokeLinecap="round" filter="url(#glow)" />
            <path d="M 64 45 L 58 51" stroke="#35C8FF" strokeWidth="3.2" strokeLinecap="round" filter="url(#glow)" />
            <path d="M 46 60 C 49 56, 51 56, 54 60" fill="none" stroke="#35C8FF" strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />
          </>
        );
      }

      if (isWorking) {
        return (
          <>
            <circle cx="40" cy="48" r="2.7" fill="#35C8FF" filter="url(#glow)" />
            <circle cx="60" cy="48" r="2.7" fill="#35C8FF" filter="url(#glow)" />
            <path d="M 47 58 C 49 59, 51 59, 53 58" fill="none" stroke="#35C8FF" strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />
          </>
        );
      }

      if (isWaiting) {
        return (
          <>
            <path d="M 35 50 C 38 45, 42 45, 45 50" fill="none" stroke="#35C8FF" strokeWidth="3.8" strokeLinecap="round" filter="url(#glow)" />
            <circle cx="60" cy="48" r="2.8" fill="#35C8FF" filter="url(#glow)" />
            <path d="M 46 59 C 48 61, 52 61, 54 59" fill="none" stroke="#35C8FF" strokeWidth="3.2" strokeLinecap="round" filter="url(#glow)" />
          </>
        );
      }

      return (
        <>
          <path d="M 34 50 C 37 44, 43 44, 46 50" fill="none" stroke="#35C8FF" strokeWidth="4.1" strokeLinecap="round" filter="url(#glow)" />
          <path d="M 54 50 C 57 44, 63 44, 66 50" fill="none" stroke="#35C8FF" strokeWidth="4.1" strokeLinecap="round" filter="url(#glow)" />
          <path d="M 46 59 C 48 62, 52 62, 54 59" fill="none" stroke="#35C8FF" strokeWidth="3.4" strokeLinecap="round" filter="url(#glow)" />
        </>
      );
    };

    return (
      <svg
        viewBox="0 0 100 100"
        className={`w-16 h-16 transition-all duration-300 drop-shadow-[0_4px_12px_rgba(0,102,255,0.35)] ${isDragging ? "scale-105 cursor-grabbing" : "cursor-grab"}`}
      >
        <defs>
          <linearGradient id="shellGrad" x1="18%" y1="10%" x2="82%" y2="92%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#F2F6FF" />
            <stop offset="100%" stopColor="#CED7E6" />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#55D7FF" />
            <stop offset="50%" stopColor="#2386FF" />
            <stop offset="100%" stopColor="#2156D9" />
          </linearGradient>
          <linearGradient id="visorGrad" x1="50%" y1="8%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#131A29" />
            <stop offset="60%" stopColor="#080D16" />
            <stop offset="100%" stopColor="#03060C" />
          </linearGradient>
          <radialGradient id="visorGlow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#1F8BFF" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1F8BFF" stopOpacity="0" />
          </radialGradient>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse cx="50" cy="95" rx="22" ry="4" fill="#08101F" opacity="0.2" />

        <g>
          <g transform="translate(63 5) rotate(38)">
            <rect x="-5.5" y="0" width="11" height="24" rx="5.5" fill="url(#blueGrad)" />
            <rect x="-4" y="1.5" width="8" height="19" rx="4" fill="#91E9FF" opacity="0.28" />
          </g>

          <ellipse cx="20" cy="44" rx="7" ry="10.5" fill="url(#blueGrad)" stroke="#1B4EB4" strokeWidth="1" />
          <ellipse cx="80" cy="44" rx="7" ry="10.5" fill="url(#blueGrad)" stroke="#1B4EB4" strokeWidth="1" />
          <g transform="translate(20 44) scale(0.42)">
            <path d={logoPath} fill="none" stroke="#EDF7FF" strokeWidth="3.6" strokeLinecap="round" />
            <rect x="-6.1" y="-7.6" width="3" height="3" fill="#EDF7FF" transform="rotate(45 -4.6 -6.1)" />
          </g>

          <path
            d="M 22 41 C 22 21, 35 14, 50 14 C 65 14, 78 21, 78 41 C 78 57, 67 71, 50 71 C 33 71, 22 57, 22 41 Z"
            fill="url(#shellGrad)"
            stroke="#DCE4F0"
            strokeWidth="1.2"
          />
          <path
            d="M 27 39 C 27 28, 36 22, 50 22 C 64 22, 73 28, 73 39 L 73 50 C 73 62, 65 67, 50 67 C 35 67, 27 62, 27 50 Z"
            fill="url(#visorGrad)"
            stroke="#20293A"
            strokeWidth="1.2"
          />
          <ellipse cx="50" cy="44" rx="20" ry="17" fill="url(#visorGlow)" />
          <path d="M 29 25 C 37 19, 52 17, 66 21" fill="none" stroke="#FFFFFF" strokeWidth="2.1" strokeLinecap="round" opacity="0.4" />

          <g transform="translate(54 34) scale(0.72)">
            <path d={logoPath} fill="none" stroke="url(#blueGrad)" strokeWidth="4" strokeLinecap="round" filter="url(#glow)" />
            <rect x="-6.1" y="-7.6" width="3" height="3" fill="#74E2FF" transform="rotate(45 -4.6 -6.1)" filter="url(#glow)" />
          </g>

          {renderFace()}

          <ellipse cx="50" cy="73" rx="10" ry="2.6" fill="#08101F" opacity="0.7" />

          <path
            d="M 33 73 C 33 65, 39 61, 50 61 C 61 61, 67 65, 67 73 L 67 89 C 67 95, 61 98, 50 98 C 39 98, 33 95, 33 89 Z"
            fill="url(#shellGrad)"
            stroke="#DCE4F0"
            strokeWidth="1.1"
          />
          <g transform="translate(50 82.5) scale(0.9)">
            <path d={logoPath} fill="none" stroke="url(#blueGrad)" strokeWidth="3.8" strokeLinecap="round" />
            <rect x="-6.1" y="-7.6" width="3" height="3" fill="#74E2FF" transform="rotate(45 -4.6 -6.1)" />
          </g>

          <path d="M 34 78 C 26 80, 24 89, 28 96" fill="none" stroke="url(#shellGrad)" strokeWidth="10" strokeLinecap="round" />
          <path d="M 32 78 C 30 79, 29 81, 29 84" fill="none" stroke="#1D58C8" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M 27 89 C 26 92, 27 94, 29 95.5" fill="none" stroke="#1D58C8" strokeWidth="4.2" strokeLinecap="round" />
          <circle cx="29" cy="96" r="4.9" fill="#FFFFFF" stroke="#DCE4F0" strokeWidth="1" />

          {isWaving ? (
            <>
              <path d="M 66 77 C 75 73, 82 64, 81 54" fill="none" stroke="url(#shellGrad)" strokeWidth="10" strokeLinecap="round" />
              <path d="M 68 77 C 70 76, 72 72, 73 69" fill="none" stroke="#1D58C8" strokeWidth="4.2" strokeLinecap="round" />
              <g transform="translate(80 53) rotate(-12)">
                <path
                  d="M -3 9 C -6 6, -6 0, -2 -3 C 0 -5, 3 -4, 4 -1 C 5 -4, 8 -4, 10 -2 C 12 0, 12 3, 10 5 C 12 7, 12 10, 9 12 C 7 14, 3 14, 1 12 C -1 13, -3 12, -4 10 Z"
                  fill="#FFFFFF"
                  stroke="#DCE4F0"
                  strokeWidth="1"
                />
              </g>
            </>
          ) : isThinking ? (
            <>
              <path d="M 66 77 C 72 76, 73 70, 67 64" fill="none" stroke="url(#shellGrad)" strokeWidth="10" strokeLinecap="round" />
              <path d="M 68 77 C 69 75, 69 72, 68 70" fill="none" stroke="#1D58C8" strokeWidth="4.2" strokeLinecap="round" />
              <circle cx="65.5" cy="62.5" r="4.6" fill="#FFFFFF" stroke="#DCE4F0" strokeWidth="1" />
            </>
          ) : (
            <>
              <path d="M 66 77 C 74 79, 76 88, 72 95" fill="none" stroke="url(#shellGrad)" strokeWidth="10" strokeLinecap="round" />
              <path d="M 68 77 C 70 78, 71 81, 71 84" fill="none" stroke="#1D58C8" strokeWidth="4.2" strokeLinecap="round" />
              <circle cx="72" cy="95" r="4.9" fill="#FFFFFF" stroke="#DCE4F0" strokeWidth="1" />
            </>
          )}

          {isCelebrating && (
            <g transform="translate(68 18)">
              <circle cx="7.5" cy="7.5" r="7.5" fill="#22C55E" stroke="#FFFFFF" strokeWidth="1.5" />
              <path d="M 4.5 7.5 L 6.5 9.5 L 10.5 5.7" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
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

      {/* ── Speech Bubble (Context or Notification toast) ── */}
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
          {/* Arrow */}
          <div
            className={`absolute bottom-[-6px] right-6 w-3 h-3 rotate-45 border-r border-b
              ${isDarkMode ? "bg-[#151B26] border-[#2d3748]" : "bg-white border-gray-100"}`}
          />
        </div>
      )}

      {/* ── Minimized Floating Action Circular Bubble ── */}
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
        /* ── Full Interactive Mascot Body ── */
        <div
          className="relative flex flex-col items-center group"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Small floating actions on hover */}
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

          {/* SVG representation + sleepy bubble */}
          <div className="relative cursor-grab active:cursor-grabbing" onClick={() => setIsOpen(prev => !prev)}>
            {renderMascotSVG()}
            {renderSleepZs()}
          </div>
        </div>
      )}

      {/* ── EXPANDED ASSISTANT PANEL ── */}
      {isOpen && !isMinimized && (
        <div
          className={`absolute bottom-20 right-0 w-80 rounded-2xl shadow-2xl overflow-hidden border animate-fade-in-up
            ${isDarkMode 
              ? "bg-[#151B26]/95 border-[#2d3748] text-white backdrop-blur-md shadow-blue-500/5" 
              : "bg-white/95 border-gray-100 text-gray-800 backdrop-blur-md"}`}
          style={{ transformOrigin: "bottom right" }}
        >
          {/* Header Panel */}
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

          {/* Body Panel */}
          <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto">
            {/* Context greeting */}
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

            {/* Live Metrics Grid */}
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

            {/* Recent Ticket Activity */}
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

          {/* Quick Actions Panel Footer */}
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
