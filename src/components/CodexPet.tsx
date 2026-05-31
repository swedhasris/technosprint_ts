import React, { useCallback, useEffect, useRef, useState } from "react";

export function CodexPet() {
  const [position, setPosition] = useState({ x: 28, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const savedX = localStorage.getItem("codex_pet_x");
    const savedY = localStorage.getItem("codex_pet_y");

    if (savedX && savedY) {
      setPosition({ x: parseInt(savedX, 10), y: parseInt(savedY, 10) });
      return;
    }

    setPosition({
      x: 28,
      y: Math.max(24, window.innerHeight - 190),
    });
  }, []);

  const persistPosition = useCallback((x: number, y: number) => {
    localStorage.setItem("codex_pet_x", String(x));
    localStorage.setItem("codex_pet_y", String(y));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    };
  };

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const newX = Math.max(10, Math.min(window.innerWidth - 130, clientX - dragStartRef.current.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 150, clientY - dragStartRef.current.y));
    setPosition({ x: newX, y: newY });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX, e.clientY);
  }, [handleMove, isDragging]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, [handleMove, isDragging]);

  const stopDragging = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    persistPosition(position.x, position.y);
  }, [isDragging, persistPosition, position.x, position.y]);

  useEffect(() => {
    if (!isDragging) return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", stopDragging);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", stopDragging);
    };
  }, [handleMouseMove, handleTouchMove, isDragging, stopDragging]);

  return (
    <div
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 99990,
        touchAction: "none",
      }}
      className="select-none"
      aria-label="Codex pet"
    >
      <button
        type="button"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`group block rounded-full bg-transparent ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        title="Drag Codex Pet"
      >
        <svg
          viewBox="0 0 180 180"
          className={`h-24 w-24 drop-shadow-[0_20px_30px_rgba(0,0,0,0.35)] transition-transform duration-300 ${isDragging ? "scale-105" : "codex-pet-float"}`}
        >
          <defs>
            <linearGradient id="codex-shell" x1="15%" y1="10%" x2="85%" y2="92%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#EEF3FF" />
              <stop offset="100%" stopColor="#CAD5E7" />
            </linearGradient>
            <linearGradient id="codex-blue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#54DEFF" />
              <stop offset="45%" stopColor="#2388FF" />
              <stop offset="100%" stopColor="#2A56DA" />
            </linearGradient>
            <linearGradient id="codex-visor" x1="50%" y1="8%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#151C2A" />
              <stop offset="100%" stopColor="#04070C" />
            </linearGradient>
            <radialGradient id="codex-glow" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#2394FF" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#2394FF" stopOpacity="0" />
            </radialGradient>
            <filter id="codex-face-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <ellipse cx="90" cy="164" rx="36" ry="8" fill="#08111F" opacity="0.22" className={isDragging ? "" : "codex-pet-shadow"} />

          <g transform="translate(111 17) rotate(38)" className={isDragging ? "" : "codex-pet-antenna"}>
            <rect x="-9" y="0" width="18" height="38" rx="9" fill="url(#codex-blue)" />
            <rect x="-6.2" y="2.5" width="12.4" height="28" rx="6.2" fill="#9CEBFF" opacity="0.28" />
          </g>

          <g className={isDragging ? "" : "codex-pet-body"}>
            <ellipse cx="42" cy="79" rx="13" ry="19" fill="url(#codex-blue)" stroke="#1C54BC" strokeWidth="1.8" />
            <ellipse cx="138" cy="79" rx="13" ry="19" fill="url(#codex-blue)" stroke="#1C54BC" strokeWidth="1.8" />

            <path
              d="M 46 73 C 46 41, 66 29, 90 29 C 114 29, 134 41, 134 73 C 134 99, 117 120, 90 120 C 63 120, 46 99, 46 73 Z"
              fill="url(#codex-shell)"
              stroke="#D9E3F1"
              strokeWidth="2"
            />

            <path
              d="M 56 70 C 56 52, 69 43, 90 43 C 111 43, 124 52, 124 70 L 124 84 C 124 103, 112 113, 90 113 C 68 113, 56 103, 56 84 Z"
              fill="url(#codex-visor)"
              stroke="#212C3B"
              strokeWidth="2"
            />

            <ellipse cx="90" cy="77" rx="31" ry="25" fill="url(#codex-glow)" className={isDragging ? "" : "codex-pet-glow"} />
            <path d="M 60 49 C 71 40, 92 38, 114 44" fill="none" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.4" />

            <g transform="translate(96 62) scale(1.05)">
              <path
                d="M 0,0 C -8.2,-8.2 -16.4,-8.2 -16.4,0 C -16.4,8.2 -8.2,8.2 0,0 C 8.2,-8.2 16.4,-8.2 16.4,0 C 16.4,8.2 8.2,8.2 0,0 Z"
                fill="none"
                stroke="url(#codex-blue)"
                strokeWidth="5"
                strokeLinecap="round"
                filter="url(#codex-face-glow)"
              />
              <rect x="-10.6" y="-13.5" width="5.3" height="5.3" fill="#74E4FF" transform="rotate(45 -8 -11)" filter="url(#codex-face-glow)" />
            </g>

            <g className={isDragging ? "" : "codex-pet-face"}>
              <path d="M 63 89 C 68 79, 77 79, 82 89" fill="none" stroke="#37CAFF" strokeWidth="6" strokeLinecap="round" filter="url(#codex-face-glow)" className="codex-pet-eye codex-pet-eye-left" />
              <path d="M 98 89 C 103 79, 112 79, 117 89" fill="none" stroke="#37CAFF" strokeWidth="6" strokeLinecap="round" filter="url(#codex-face-glow)" className="codex-pet-eye codex-pet-eye-right" />
              <path d="M 84 103 C 87 108, 93 108, 96 103" fill="none" stroke="#37CAFF" strokeWidth="5.4" strokeLinecap="round" filter="url(#codex-face-glow)" className="codex-pet-mouth" />
            </g>

            <ellipse cx="90" cy="124" rx="17" ry="4.5" fill="#08111F" opacity="0.72" />

            <path
              d="M 61 123 C 61 111, 70 105, 90 105 C 110 105, 119 111, 119 123 L 119 151 C 119 161, 109 167, 90 167 C 71 167, 61 161, 61 151 Z"
              fill="url(#codex-shell)"
              stroke="#D9E3F1"
              strokeWidth="1.8"
            />

            <g transform="translate(90 141) scale(1)">
              <path
                d="M 0,0 C -8,-8 -16,-8 -16,0 C -16,8 -8,8 0,0 C 8,-8 16,-8 16,0 C 16,8 8,8 0,0 Z"
                fill="none"
                stroke="url(#codex-blue)"
                strokeWidth="4.8"
                strokeLinecap="round"
              />
              <rect x="-10.2" y="-13" width="5.1" height="5.1" fill="#6CDFFF" transform="rotate(45 -7.7 -10.5)" />
            </g>

            <path d="M 62 132 C 50 135, 47 147, 52 161" fill="none" stroke="url(#codex-shell)" strokeWidth="14" strokeLinecap="round" />
            <path d="M 58 131 C 54 133, 52 137, 52 141" fill="none" stroke="#1D58C8" strokeWidth="6" strokeLinecap="round" />
            <circle cx="52" cy="161" r="7" fill="#FFFFFF" stroke="#DCE4F0" strokeWidth="1.5" />

            <path d="M 118 131 C 130 126, 141 114, 140 98" fill="none" stroke="url(#codex-shell)" strokeWidth="14" strokeLinecap="round" />
            <path d="M 122 131 C 125 129, 128 124, 129 119" fill="none" stroke="#1D58C8" strokeWidth="6" strokeLinecap="round" />
            <g transform="translate(140 97) rotate(-12)" className={isDragging ? "" : "codex-pet-wave"}>
              <path
                d="M -4 13 C -9 8 -9 0 -3 -4 C 0 -7 4 -6 6 -2 C 7 -6 12 -6 15 -3 C 18 0 18 5 15 8 C 18 10 18 14 14 17 C 11 20 5 20 2 17 C -1 19 -5 18 -7 14 Z"
                fill="#FFFFFF"
                stroke="#DCE4F0"
                strokeWidth="1.5"
              />
            </g>
          </g>
        </svg>
      </button>
    </div>
  );
}
