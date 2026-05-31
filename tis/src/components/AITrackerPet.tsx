/**
 * AITrackerPet — Premium 3D AI Pet Companion
 *
 * Standalone overlay. Appears ONLY when AI Activity Tracker is active.
 * Transparent, borderless mascot float indicator.
 *
 * ZERO changes to any existing component, page, style, or feature.
 * This component is 100% self-contained and additive.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useActivityTracker } from "../contexts/ActivityTrackerContext";
import { useAuth } from "../contexts/AuthContext";
import "../styles/ai-tracker-pet.css";

// ─── Types ───────────────────────────────────────────────────────────────────
type PetMood =
  | "WALKING" | "RUNNING" | "SITTING" | "WAVING" | "LOOKING"
  | "BLINKING" | "STRETCHING" | "SLEEPING" | "JUMPING" | "CELEBRATING"
  | "THINKING" | "OBSERVING" | "EXCITED" | "WARNING" | "HAPPY";

interface Waypoint { x: number; y: number; }

export type TrackerOverlayState =
  | "ACTIVE"
  | "CAPTURED"
  | "UPLOADING"
  | "PROCESSING"
  | "PAUSED"
  | "ERROR"
  | "DISCONNECTED"
  | "STOPPED";

// ─── Constants ────────────────────────────────────────────────────────────────
const EDGE_MARGIN = 12;

// ─── Main Component ───────────────────────────────────────────────────────────
export function AITrackerPet() {
  // ── Auth context ──
  const { profile } = useAuth();

  // ── Tracker context ──
  const tracker = useActivityTracker();
  const trackerStatus  = tracker.status;
  const trackerEntries = tracker.entries ?? [];
  const trackerError   = tracker.error ?? null;
  const trackerSummary = tracker.summary ?? null;

  const isTicketTimerRunning = profile?.activeTimer?.isRunning === true;
  const isTrackerActive = trackerStatus === "active" || isTicketTimerRunning;

  // ── Component state ──
  const [visible, setVisible] = useState(false);
  const [isDisappearing, setIsDisappearing] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);

  // ── Drag, Scale, Minimize configs ──
  const [position, setPosition] = useState<Waypoint>({
    x: window.innerWidth - 140,
    y: window.innerHeight - 155,
  });
  const [scale, setScale] = useState(1.0);
  const [isLocked, setIsLocked] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // ── Live Status Indicator Overlay State ──
  const [trackerState, setTrackerState] = useState<TrackerOverlayState>("STOPPED");
  const [trackerStatusText, setTrackerStatusText] = useState("Tracker Stopped");
  const [lastCaptureTime, setLastCaptureTime] = useState<string>("");
  const [heartbeatTrigger, setHeartbeatTrigger] = useState(false);

  // ── Refs ──
  const isMountedRef = useRef(false);
  const prevEntriesLenRef = useRef(0);
  const prevLastProcessingRef = useRef<boolean | undefined>(undefined);
  const prevErrorRef = useRef<string | null>(null);
  const prevSummaryRef = useRef<string | null>(null);
  const prevScreenshotUrlRef = useRef<string | null>(null);



  // ── Load saved configurations on mount ──
  useEffect(() => {
    const savedX = localStorage.getItem('react_pet_x');
    const savedY = localStorage.getItem('react_pet_y');
    const savedScale = localStorage.getItem('react_pet_scale');
    const savedLocked = localStorage.getItem('react_pet_locked') === 'true';
    const savedMinimized = localStorage.getItem('react_pet_minimized') === 'true';

    if (savedScale) setScale(parseFloat(savedScale));
    setIsLocked(savedLocked);
    setIsMinimized(savedMinimized);

    const W = window.innerWidth;
    const H = window.innerHeight;
    const initialWidth = 115 * (savedScale ? parseFloat(savedScale) : 1.0);
    const initialHeight = 115 * (savedScale ? parseFloat(savedScale) : 1.0);

    if (savedX && savedY) {
      const px = Math.max(4, Math.min(W - initialWidth - 4, parseInt(savedX, 10)));
      const py = Math.max(4, Math.min(H - initialHeight - 4, parseInt(savedY, 10)));
      setPosition({ x: px, y: py });
    } else {
      setPosition({
        x: Math.max(4, W - initialWidth - 24),
        y: Math.max(4, H - initialHeight - 24),
      });
    }
  }, []);

  // ── Drag Handlers ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return;
    if (e.target instanceof HTMLButtonElement || (e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const size = 115 * scale;
      const x = Math.max(4, Math.min(W - size - 4, e.clientX - dragStart.current.x));
      const y = Math.max(4, Math.min(H - size - 4, e.clientY - dragStart.current.y));
      
      setPosition({ x, y });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        localStorage.setItem('react_pet_x', position.x.toString());
        localStorage.setItem('react_pet_y', position.y.toString());
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position, scale]);

  // ── Mount: tracker becomes active ──
  useEffect(() => {
    if (isTrackerActive && !visible && !isDisappearing) {
      isMountedRef.current = true;
      prevEntriesLenRef.current = 0;
      prevLastProcessingRef.current = undefined;
      prevErrorRef.current = null;
      prevSummaryRef.current = null;

      setVisible(true);
      setIsDisappearing(false);
    }
  }, [isTrackerActive]);

  // ── Unmount: tracker becomes inactive ──
  useEffect(() => {
    if (!isTrackerActive && visible && !isDisappearing) {
      setIsDisappearing(true);
      const timer = setTimeout(() => {
        isMountedRef.current = false;
        setVisible(false);
        setIsDisappearing(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isTrackerActive]);

  // ── React to tracker entries ──
  useEffect(() => {
    if (!visible || !isTrackerActive || !isMountedRef.current) return;
    const len = trackerEntries.length;
    prevEntriesLenRef.current = len;
    if (len > 0) {
      const lastEntry = trackerEntries[len - 1];
      prevLastProcessingRef.current = lastEntry?.isProcessing;
    }
  }, [trackerEntries, visible, isTrackerActive]);

  // ── React to errors ──
  useEffect(() => {
    if (!visible || !isTrackerActive || !isMountedRef.current) return;
    if (trackerError) {
      prevErrorRef.current = trackerError;
    }
  }, [trackerError, visible, isTrackerActive]);

  // ── React to summary (session complete) ──
  useEffect(() => {
    if (!visible || !isMountedRef.current) return;
    if (trackerSummary) {
      prevSummaryRef.current = trackerSummary;
    }
  }, [trackerSummary, visible]);

  // ── Live Status State Machine Calculations ──
  useEffect(() => {
    if (!isTrackerActive) {
      setTrackerState("STOPPED");
      setTrackerStatusText("Tracker Stopped");
      return;
    }

    if (trackerError) {
      setTrackerState("ERROR");
      setTrackerStatusText("Tracker Error");
      return;
    }

    const len = trackerEntries.length;
    if (len === 0) {
      setTrackerState("ACTIVE");
      setTrackerStatusText("AI Activity Tracker Running");
      return;
    }

    const lastEntry = trackerEntries[len - 1];

    if (lastEntry.isIdle) {
      setTrackerState("PAUSED");
      setTrackerStatusText("Tracker Paused");
      return;
    }

    // Capture dynamic screenshots transition
    const currentUrl = lastEntry?.screenshotUrl || null;
    const prevUrl = prevScreenshotUrlRef.current;

    if (currentUrl && currentUrl !== prevUrl) {
      prevScreenshotUrlRef.current = currentUrl;
      
      setTrackerState("CAPTURED");
      setTrackerStatusText("Screenshot Captured Successfully");
      
      const timeStr = new Date(lastEntry.timestamp || Date.now()).toLocaleTimeString();
      setLastCaptureTime(timeStr);
      setHeartbeatTrigger(prev => !prev);

      const timer = setTimeout(() => {
        if (lastEntry.isProcessing) {
          setTrackerState("PROCESSING");
          setTrackerStatusText("Processing Activity");
        } else {
          setTrackerState("ACTIVE");
          setTrackerStatusText("AI Activity Tracker Running");
        }
      }, 3000);

      return () => clearTimeout(timer);
    }

    if (lastEntry.isProcessing) {
      if (lastEntry.screenshotFilename && !lastEntry.screenshotUrl) {
        setTrackerState("UPLOADING");
        setTrackerStatusText("Uploading Activity");
      } else {
        setTrackerState("PROCESSING");
        setTrackerStatusText("Processing Activity");
      }
    } else {
      setTrackerState("ACTIVE");
      setTrackerStatusText("AI Activity Tracker Running");
    }
  }, [trackerStatus, trackerEntries, trackerError, isTrackerActive]);

  // ── Sync with Electron Pet Overlay ──
  useEffect(() => {
    if ((window as any).electronAPI?.isElectron) {
      (window as any).electronAPI.updatePetStatus({
        visible: isTrackerActive,
        mood: trackerState === "ACTIVE" ? "HAPPY" :
              trackerState === "CAPTURED" ? "HAPPY" :
              trackerState === "UPLOADING" ? "WORKING" :
              trackerState === "PROCESSING" ? "THINKING" :
              trackerState === "PAUSED" ? "WAITING" :
              trackerState === "ERROR" ? "ALERT" :
              trackerState === "DISCONNECTED" ? "WARNING" : "SLEEPING",
        trackerState,
        trackerStatusText,
        lastCaptureTime,
        heartbeatTrigger,
        facingLeft,
        labelText: trackerStatusText,
        showLabel: true,
      });
    }
  }, [isTrackerActive, trackerState, trackerStatusText, lastCaptureTime, heartbeatTrigger, facingLeft]);



  // ─── Don't render if not active or inside Electron (system-wide overlay is active) ───
  if (!visible || (window as any).electronAPI?.isElectron) return null;

  const stateColors = {
    ACTIVE: '#10B981',       // Green Glow
    CAPTURED: '#10B981',     // Green Glow
    UPLOADING: '#3B82F6',    // Blue Ring
    PROCESSING: '#F59E0B',   // Orange Ring
    PAUSED: '#EAB308',       // Yellow Ring
    ERROR: '#EF4444',        // Red Ring
    DISCONNECTED: '#EF4444', // Red Ring
    STOPPED: '#6B7280'       // Gray Ring
  };
  const activeColor = stateColors[trackerState] || '#10B981';

  const assetMap = {
    ACTIVE: 'active',
    CAPTURED: 'success',
    UPLOADING: 'working',
    PROCESSING: 'thinking',
    PAUSED: 'waiting',
    ERROR: 'alert',
    DISCONNECTED: 'concerned',
    STOPPED: 'waiting'
  };
  const filename = assetMap[trackerState] || 'active';

  const animMap = {
    ACTIVE: 'atp-happy',
    CAPTURED: 'atp-celebrate',
    UPLOADING: 'atp-walk',
    PROCESSING: 'atp-think',
    PAUSED: 'atp-sit',
    ERROR: 'atp-warning',
    DISCONNECTED: 'atp-observe',
    STOPPED: 'atp-sleep'
  };
  const animClass = animMap[trackerState] || 'atp-happy';

  return (
    <div
      id="ai-tracker-pet-root"
      onMouseDown={handleMouseDown}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: 115 * scale,
        height: 115 * scale,
        zIndex: 999990,
        pointerEvents: "auto",
        userSelect: "none",
        cursor: isLocked ? "default" : isDragging ? "grabbing" : "grab",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transition: isDragging ? "none" : "width 0.3s ease, height 0.3s ease, left 0.2s ease, top 0.2s ease",
      }}
      className={`${isMinimized ? "minimized" : ""} ${isDisappearing ? "atp-pet-disappear" : "atp-pet-appear"}`}
      onDoubleClick={() => {
        if (isMinimized) {
          setIsMinimized(false);
          localStorage.setItem('react_pet_minimized', 'false');
        }
      }}
    >
      {/* ── Hover Controls (Invisible by default, fades on hover) ── */}
      {!isMinimized && (
        <div className="atp-hover-controls">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const nextLocked = !isLocked;
              setIsLocked(nextLocked);
              localStorage.setItem('react_pet_locked', nextLocked.toString());
            }}
            className={`atp-btn ${isLocked ? "locked" : ""}`}
            title="Lock/Unlock Position"
          >
            {isLocked ? "🔒" : "🔓"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const nextScale = Math.max(0.7, scale - 0.1);
              setScale(nextScale);
              localStorage.setItem('react_pet_scale', nextScale.toString());
            }}
            className="atp-btn"
            title="Resize Smaller"
          >
            −
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const nextScale = Math.min(1.6, scale + 0.1);
              setScale(nextScale);
              localStorage.setItem('react_pet_scale', nextScale.toString());
            }}
            className="atp-btn"
            title="Resize Larger"
          >
            +
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
              localStorage.setItem('react_pet_minimized', 'true');
            }}
            className="atp-btn"
            title="Minimize"
          >
            _
          </button>
        </div>
      )}

      {/* ── Glassmorphic Tooltip Speech Bubble ── */}
      {!isMinimized && (
        <div className="atp-hover-tooltip">
          <span className="atp-tooltip-title">{trackerStatusText}</span>
          <span className="atp-tooltip-sub">
            <span className="atp-heartbeat-dot"></span>
            {lastCaptureTime ? `Captured: ${lastCaptureTime}` : "Heartbeat Active"}
          </span>
        </div>
      )}

      {/* ── Mascot Image Display ── */}
      <div className="atp-body-wrapper">
        <div
          className="atp-img-wrapper"
          style={{
            borderColor: activeColor,
            boxShadow: `0 0 ${14 * scale}px ${activeColor}, inset 0 0 ${6 * scale}px ${activeColor}`,
            padding: 6 * scale,
            width: isMinimized ? 42 * scale : 'auto',
            height: isMinimized ? 42 * scale : 'auto',
          }}
        >
          <img
            src={`/assets/technosprint-pet/${filename}.png`}
            alt=""
            draggable={false}
            className={`atp-pet-img ${animClass}`}
            style={{
              width: isMinimized ? 30 * scale : 68 * scale,
              height: isMinimized ? 30 * scale : 68 * scale,
            }}
          />
          <div className="atp-specular" style={{ width: 20 * scale, height: 12 * scale }} />
          <div className="atp-rim" style={{ width: 14 * scale, height: 6 * scale }} />
          
          {/* Green Tick Checkmark overlay on captured state */}
          {trackerState === "CAPTURED" && (
            <div
              className="atp-tick-badge"
              style={{
                width: isMinimized ? 14 * scale : 20 * scale,
                height: isMinimized ? 14 * scale : 20 * scale,
                fontSize: isMinimized ? 8 * scale : 10 * scale,
                top: isMinimized ? -6 : -4,
                right: isMinimized ? -6 : -4,
              }}
            >
              ✓
            </div>
          )}
        </div>
        {!isMinimized && <div className="atp-shadow" style={{ width: 44 * scale, height: 8 * scale, bottom: -12 * scale }} />}
      </div>
    </div>
  );
}
