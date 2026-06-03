// Global Persistent Overlay Content Script - Ticklora Assistant

(function () {
  // Prevent duplicate injections on the same page
  if (document.getElementById("ticklora-global-overlay-container")) return;

  // 1. Initial State Definition
  let state = {
    role: "user",
    userName: "Technician",
    openTickets: 0,
    pendingTickets: 0,
    assignedTickets: 0,
    resolvedTickets: 0,
    aiTask: "",
    isTrackerOn: false,
    petState: "ACTIVE",
    bubbleText: "Ticklora Assistant is at your service! ⚡"
  };

  let position = { x: window.innerWidth - 384, y: window.innerHeight - 150 };
  let isMinimized = false;
  let snappingEnabled = true;
  
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let bubbleTimer = null;

  // 2. Load Coordinates & Minimized State from Storage on Load
  chrome.storage.local.get(
    ["overlayX", "overlayY", "overlayMinimized", "overlaySnapEnabled", "syncedState"],
    (result) => {
      if (result.syncedState) {
        state = { ...state, ...result.syncedState };
      }
      
      snappingEnabled = result.overlaySnapEnabled !== false;
      isMinimized = result.overlayMinimized === true;

      const W = window.innerWidth;
      const H = window.innerHeight;
      const overlayW = isMinimized ? 52 : 360;
      const overlayH = isMinimized ? 52 : 86;

      if (result.overlayX !== undefined && result.overlayY !== undefined) {
        position.x = Math.max(4, Math.min(W - overlayW - 4, parseInt(result.overlayX, 10)));
        position.y = Math.max(4, Math.min(H - overlayH - 4, parseInt(result.overlayY, 10)));
      } else {
        position.x = W - overlayW - 24;
        position.y = H - overlayH - 120;
      }
      
      initOverlay();
    }
  );

  // 3. React App Communication Bridge (Message Listener)
  // Listen for custom postMessage state packets originating from the Ticklora website tab
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;
    
    if (event.data.type === "TICKLORA_STATE_UPDATE" && event.data.state) {
      const newState = event.data.state;
      state = { ...state, ...newState };
      
      // Save state to Chrome Extension Storage
      chrome.storage.local.set({ syncedState: state });
      
      // Update UI elements in this tab
      updateOverlayUI();
      
      // Broadcast state update globally to other active tabs via background service worker
      chrome.runtime.sendMessage({
        type: "BROADCAST_STATE",
        state: state
      }).catch(() => {
        // Ignore message failures when extension reloaded
      });
    }
  });

  // 4. Secure Service Worker Sync Listener
  // Listen for broadcast sync updates sent by other open tabs
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SYNC_STATE" && message.state) {
      state = { ...state, ...message.state };
      updateOverlayUI();
    }
  });

  // 5. Build and Inject the Overlay in the DOM
  function initOverlay() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", initOverlay);
      setTimeout(initOverlay, 50);
      return;
    }
    document.removeEventListener("DOMContentLoaded", initOverlay);

    // Prevent duplicate injections on the same page
    if (document.getElementById("ticklora-global-overlay-container")) return;

    const root = document.createElement("div");
    root.id = "ticklora-global-overlay-container";
    root.className = "ticklora-global-overlay-root";
    root.style.left = `${position.x}px`;
    root.style.top = `${position.y}px`;
    document.body.appendChild(root);

    renderOverlay();
    setupDragGestures();
    
    // Auto trigger bubble on startup to greet user
    triggerBubble(state.bubbleText);
  }

  // 6. HTML Render Templates
  function renderOverlay() {
    const container = document.getElementById("ticklora-global-overlay-container");
    if (!container) return;

    if (isMinimized) {
      container.innerHTML = `
        <div class="ticklora-overlay-minimized" title="Restore global assistant">
          ${getMascotSVG("WAITING", true)}
          <span class="ticklora-overlay-minimized-pulse">+</span>
        </div>
      `;
    } else {
      const isTrackerActive = state.isTrackerOn;
      const isDarkMode = document.documentElement.classList.contains("dark");
      
      // Map active state color highlights
      const stateColors = {
        ACTIVE: '#3b82f6',
        CELEBRATING: '#22c55e',
        THINKING: '#f59e0b',
        WORKING: '#f59e0b',
        SLEEPING: '#64748b',
        ERROR: '#ef4444'
      };
      const activeColor = stateColors[state.petState] || '#3b82f6';

      container.innerHTML = `
        <div class="ticklora-overlay-bar">
          <!-- Grab Drag Handle -->
          <div class="ticklora-overlay-drag-handle" title="Drag overlay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <circle cx="9" cy="5" r="1"/>
              <circle cx="9" cy="12" r="1"/>
              <circle cx="9" cy="19" r="1"/>
              <circle cx="15" cy="5" r="1"/>
              <circle cx="15" cy="12" r="1"/>
              <circle cx="15" cy="19" r="1"/>
            </svg>
          </div>

          <!-- Glassmorphic Tooltip Speech Bubble -->
          <div class="ticklora-overlay-bubble" id="ticklora-overlay-bubble-el" style="display: none;">
            <div class="ticklora-overlay-bubble-header">
              <svg style="width: 10px; height: 10px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span>Assistant Notification</span>
            </div>
            <div id="ticklora-bubble-text-el">${state.bubbleText}</div>
            <div class="ticklora-overlay-bubble-arrow"></div>
          </div>

          <!-- Self-contained Premium Animated Mascot -->
          <div class="ticklora-overlay-mascot-container" style="filter: drop-shadow(0 0 8px ${activeColor});">
            ${getMascotSVG(state.petState, false)}
          </div>

          <div class="ticklora-overlay-divider"></div>

          <!-- Persistent Overlay Quick Actions -->
          <div class="ticklora-overlay-actions">
            <!-- Home Link -->
            <button class="ticklora-overlay-btn" id="ticklora-btn-home" title="Go to Dashboard">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="9"/>
                <rect x="14" y="3" width="7" height="5"/>
                <rect x="14" y="12" width="7" height="9"/>
                <rect x="3" y="16" width="7" height="5"/>
              </svg>
            </button>

            <!-- Create Link -->
            <button class="ticklora-overlay-btn" id="ticklora-btn-create" title="Create Incident">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </button>

            <!-- SLA / Status Widget button -->
            <button class="ticklora-overlay-btn ${isTrackerOn ? 'active' : ''}" id="ticklora-btn-tracker" title="Tracker Status: ${isTrackerOn ? 'Active' : 'Idle'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </button>

            <!-- Snap magnetic Toggle -->
            <button class="ticklora-overlay-btn ${snappingEnabled ? 'active' : ''}" id="ticklora-btn-snap" title="${snappingEnabled ? 'Disable Edge Snapping' : 'Enable Edge Snapping'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="17" x2="12" y2="22"/>
                <path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.24V5a3 3 0 0 0-6 0v4.24a2 2 0 0 1-.78 1.28l-2.78 3.5A2 2 0 0 0 5 15.24z"/>
              </svg>
            </button>

            <!-- Minimize Button -->
            <button class="ticklora-overlay-btn" id="ticklora-btn-minimize" title="Minimize Overlay">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      `;

      setupButtonListeners();
    }
  }

  // 7. Dynamic UI Refreshers
  function updateOverlayUI() {
    const container = document.getElementById("ticklora-global-overlay-container");
    if (!container) return;

    // Rerender the core container cleanly to pick up state updates
    renderOverlay();
    
    // Reactivate draggable listeners
    setupDragGestures();
    
    // Auto show speech tooltip if state message changed
    if (state.bubbleText) {
      triggerBubble(state.bubbleText);
    }
  }

  // 8. Event Listeners for Floating Dock Actions
  function setupButtonListeners() {
    const btnHome = document.getElementById("ticklora-btn-home");
    const btnCreate = document.getElementById("ticklora-btn-create");
    const btnTracker = document.getElementById("ticklora-btn-tracker");
    const btnSnap = document.getElementById("ticklora-btn-snap");
    const btnMinimize = document.getElementById("ticklora-btn-minimize");
    const mascot = document.querySelector(".ticklora-overlay-mascot-container");

    const appRoot = "http://localhost:3000";

    if (btnHome) {
      btnHome.addEventListener("click", (e) => {
        e.stopPropagation();
        window.open(`${appRoot}/my-dashboard`, "_blank");
      });
    }

    if (btnCreate) {
      btnCreate.addEventListener("click", (e) => {
        e.stopPropagation();
        window.open(`${appRoot}/tickets?action=create`, "_blank");
      });
    }

    if (btnTracker) {
      btnTracker.addEventListener("click", (e) => {
        e.stopPropagation();
        window.open(`${appRoot}/activity-tracker`, "_blank");
      });
    }

    if (btnSnap) {
      btnSnap.addEventListener("click", (e) => {
        e.stopPropagation();
        snappingEnabled = !snappingEnabled;
        chrome.storage.local.set({ overlaySnapEnabled: snappingEnabled });
        btnSnap.classList.toggle("active", snappingEnabled);
      });
    }

    if (btnMinimize) {
      btnMinimize.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMinimize(true);
      });
    }

    if (mascot) {
      mascot.addEventListener("click", (e) => {
        e.stopPropagation();
        // mascot click triggers quick greeting bubble
        triggerBubble(`Active Tickets: ${state.openTickets} Open | ${state.pendingTickets} Pending. Let's solve them! 🔧`);
      });
    }
  }

  function toggleMinimize(min) {
    isMinimized = min;
    chrome.storage.local.set({ overlayMinimized: isMinimized });
    
    const container = document.getElementById("ticklora-global-overlay-container");
    if (container) {
      // Re-initialize location bounds to fit circular pill
      const W = window.innerWidth;
      const H = window.innerHeight;
      const w = isMinimized ? 52 : 360;
      const h = isMinimized ? 52 : 86;

      position.x = Math.max(4, Math.min(W - w - 4, position.x));
      position.y = Math.max(4, Math.min(H - h - 4, position.y));

      container.style.left = `${position.x}px`;
      container.style.top = `${position.y}px`;
      
      updateOverlayUI();
    }
  }

  // 9. Interactive Dragging & Smart Edge-Snapping Gestures
  function setupDragGestures() {
    const container = document.getElementById("ticklora-global-overlay-container");
    if (!container) return;

    const dragTrigger = isMinimized 
      ? container.querySelector(".ticklora-overlay-minimized") 
      : container.querySelector(".ticklora-overlay-drag-handle");

    if (!dragTrigger) return;

    const onMouseDown = (e) => {
      isDragging = true;
      dragStart = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
      e.preventDefault();
    };

    const onTouchStart = (e) => {
      isDragging = true;
      const touch = e.touches[0];
      dragStart = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      };
    };

    const onMove = (clientX, clientY) => {
      if (!isDragging) return;

      const W = window.innerWidth;
      const H = window.innerHeight;
      const w = isMinimized ? 52 : 360;
      const h = isMinimized ? 52 : 86;

      let nextX = clientX - dragStart.x;
      let nextY = clientY - dragStart.y;

      nextX = Math.max(4, Math.min(W - w - 4, nextX));
      nextY = Math.max(4, Math.min(H - h - 4, nextY));

      position.x = nextX;
      position.y = nextY;

      container.style.left = `${position.x}px`;
      container.style.top = `${position.y}px`;
    };

    const onMouseMove = (e) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      const touch = e.touches[0];
      onMove(touch.clientX, touch.clientY);
    };

    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;

      // Smart Snapping to screen boundaries
      if (snappingEnabled) {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const w = isMinimized ? 52 : 360;
        const h = isMinimized ? 52 : 86;

        const SNAP_THRESHOLD = 32;
        const GAP = 8;

        const distLeft = position.x;
        const distRight = W - (position.x + w);
        const distTop = position.y;
        const distBottom = H - (position.y + h);

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);

        if (minDist < SNAP_THRESHOLD) {
          container.classList.add("ticklora-overlay-snapping");
          
          if (minDist === distLeft) {
            position.x = GAP;
          } else if (minDist === distRight) {
            position.x = W - w - GAP;
          } else if (minDist === distTop) {
            position.y = GAP;
          } else {
            position.y = H - h - GAP;
          }

          container.style.left = `${position.x}px`;
          container.style.top = `${position.y}px`;

          setTimeout(() => {
            container.classList.remove("ticklora-overlay-snapping");
          }, 200);
        }
      }

      chrome.storage.local.set({
        overlayX: position.x,
        overlayY: position.y
      });
    };

    dragTrigger.addEventListener("mousedown", onMouseDown);
    dragTrigger.addEventListener("touchstart", onTouchStart, { passive: true });

    // Global document listeners while dragging
    const addGlobalListeners = () => {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onDragEnd);
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onDragEnd);
    };

    const removeGlobalListeners = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onDragEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onDragEnd);
    };

    dragTrigger.addEventListener("mousedown", addGlobalListeners);
    dragTrigger.addEventListener("touchstart", addGlobalListeners);
    document.addEventListener("mouseup", removeGlobalListeners);
    document.addEventListener("touchend", removeGlobalListeners);

    // Double click minimized trigger restores
    if (isMinimized) {
      dragTrigger.addEventListener("dblclick", () => {
        toggleMinimize(false);
      });
    }
  }

  // 10. Speech tooltip triggers
  function triggerBubble(text) {
    if (!text || isMinimized) return;
    
    const bubble = document.getElementById("ticklora-overlay-bubble-el");
    const bubbleText = document.getElementById("ticklora-bubble-text-el");

    if (bubble && bubbleText) {
      if (bubbleTimer) clearTimeout(bubbleTimer);
      
      bubbleText.innerText = text;
      bubble.style.display = "block";
      
      bubbleTimer = setTimeout(() => {
        bubble.style.display = "none";
      }, 6500);
    }
  }

  // 11. Self-Contained Premium Vector SVG Mascot drawing
  // Adapts moods, color glows, waving, and eye blinking dynamically based on sync states
  function getMascotSVG(petMood, small) {
    const isSleeping = petMood === "SLEEPING" || petMood === "IDLE";
    const isThinking = petMood === "THINKING";
    const isCelebrating = petMood === "CELEBRATING" || petMood === "SUCCESS";
    const isWorking = petMood === "WORKING" || petMood === "WRITING";
    const isError = petMood === "ERROR" || petMood === "ALERT";

    const animClass = isCelebrating ? "ticklora-mascot-celebrate" :
                      isSleeping ? "ticklora-mascot-sleep" :
                      isThinking || isWorking ? "ticklora-mascot-think" :
                      "ticklora-mascot-float";

    const visorGlowColor = isCelebrating ? "#22c55e" :
                           isError ? "#ef4444" :
                           isThinking ? "#f59e0b" :
                           "#37caff";

    const svgScale = small ? "scale(0.55)" : "scale(1)";

    return `
      <svg viewBox="0 0 180 180" class="${animClass}" style="width: 100%; height: 100%; transform: ${svgScale}; transform-origin: center; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));">
        <defs>
          <linearGradient id="ext-shell" x1="15%" y1="10%" x2="85%" y2="92%">
            <stop offset="0%" stop-color="#FFFFFF" />
            <stop offset="55%" stop-color="#EEF3FF" />
            <stop offset="100%" stop-color="#CAD5E7" />
          </linearGradient>
          <linearGradient id="ext-blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#54DEFF" />
            <stop offset="45%" stop-color="#2388FF" />
            <stop offset="100%" stop-color="#2A56DA" />
          </linearGradient>
          <linearGradient id="ext-visor" x1="50%" y1="8%" x2="50%" y2="100%">
            <stop offset="0%" stop-color="#151C2A" />
            <stop offset="100%" stop-color="#04070C" />
          </linearGradient>
          <filter id="ext-face-glow">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <!-- Shadow ellipse -->
        <ellipse cx="90" cy="164" rx="36" ry="8" fill="#08111F" opacity="0.22" />

        <!-- Rotating Antenna -->
        <g transform="translate(111 17) rotate(38)">
          <rect x="-9" y="0" width="18" height="38" rx="9" fill="url(#ext-blue)" />
          <rect x="-6.2" y="2.5" width="12.4" height="28" rx="6.2" fill="#9CEBFF" opacity="0.28" />
        </g>

        <!-- Core Body components -->
        <g>
          <!-- Left/Right Ears -->
          <ellipse cx="42" cy="79" rx="13" ry="19" fill="url(#ext-blue)" stroke="#1C54BC" stroke-width="1.8" />
          <ellipse cx="138" cy="79" rx="13" ry="19" fill="url(#ext-blue)" stroke="#1C54BC" stroke-width="1.8" />

          <!-- Outer Shell -->
          <path
            d="M 46 73 C 46 41, 66 29, 90 29 C 114 29, 134 41, 134 73 C 134 99, 117 120, 90 120 C 63 120, 46 99, 46 73 Z"
            fill="url(#ext-shell)"
            stroke="#D9E3F1"
            stroke-width="2"
          />

          <!-- Glossy Black Visor -->
          <path
            d="M 56 70 C 56 52, 69 43, 90 43 C 111 43, 124 52, 124 70 L 124 84 C 124 103, 112 113, 90 113 C 68 113, 56 103, 56 84 Z"
            fill="url(#ext-visor)"
            stroke="#212C3B"
            stroke-width="2"
          />

          <!-- Glossy Highlights -->
          <path d="M 60 49 C 71 40, 92 38, 114 44" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" opacity="0.4" />

          <!-- Eye indicators that toggle shapes depending on moods -->
          <g>
            ${isSleeping ? `
              <!-- Closed Sleeping eyes -->
              <path d="M 63 89 C 67 93, 75 93, 79 89" fill="none" stroke="#64748b" stroke-width="6" stroke-linecap="round" filter="url(#ext-face-glow)" />
              <path d="M 98 89 C 102 93, 110 93, 114 89" fill="none" stroke="#64748b" stroke-width="6" stroke-linecap="round" filter="url(#ext-face-glow)" />
            ` : isCelebrating ? `
              <!-- Happy celebrating eyes (Arching arrows) -->
              <path d="M 61 91 C 65 85, 73 85, 77 91" fill="none" stroke="${visorGlowColor}" stroke-width="6.5" stroke-linecap="round" filter="url(#ext-face-glow)" />
              <path d="M 100 91 C 104 85, 112 85, 116 91" fill="none" stroke="${visorGlowColor}" stroke-width="6.5" stroke-linecap="round" filter="url(#ext-face-glow)" />
            ` : `
              <!-- Default wide blinking eyes -->
              <path d="M 63 89 C 68 79, 77 79, 82 89" fill="none" stroke="${visorGlowColor}" stroke-width="6" stroke-linecap="round" filter="url(#ext-face-glow)" />
              <path d="M 98 89 C 103 79, 112 79, 117 89" fill="none" stroke="${visorGlowColor}" stroke-width="6" stroke-linecap="round" filter="url(#ext-face-glow)" />
            `}
            
            <!-- Cute vector smiling mouth -->
            <path d="M 85 102 C 87 106, 91 106, 93 102" fill="none" stroke="${visorGlowColor}" stroke-width="5" stroke-linecap="round" filter="url(#ext-face-glow)" />
          </g>

          <ellipse cx="90" cy="124" rx="17" ry="4.5" fill="#08111F" opacity="0.72" />

          <!-- Bottom Base Body -->
          <path
            d="M 61 123 C 61 111, 70 105, 90 105 C 110 105, 119 111, 119 123 L 119 151 C 119 161, 109 167, 90 167 C 71 167, 61 161, 61 151 Z"
            fill="url(#ext-shell)"
            stroke="#D9E3F1"
            stroke-width="1.8"
          />

          <!-- Arm indicators -->
          <path d="M 62 132 C 50 135, 47 147, 52 161" fill="none" stroke="url(#ext-shell)" stroke-width="14" stroke-linecap="round" />
          <path d="M 118 131 C 130 126, 141 114, 140 98" fill="none" stroke="url(#ext-shell)" stroke-width="14" stroke-linecap="round" />
          
          <!-- Cute Waving hand animation on default/celebrate -->
          <g transform="translate(140 97) rotate(-12)">
            <path
              d="M -4 13 C -9 8 -9 0 -3 -4 C 0 -7 4 -6 6 -2 C 7 -6 12 -6 15 -3 C 18 0 18 5 15 8 C 18 10 18 14 14 17 C 11 20 5 20 2 17 C -1 19 -5 18 -7 14 Z"
              fill="#FFFFFF"
              stroke="#DCE4F0"
              stroke-width="1.5"
            />
          </g>
        </g>
      </svg>
    `;
  }
})();
