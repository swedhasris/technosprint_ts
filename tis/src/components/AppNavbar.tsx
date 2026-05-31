import React from "react";
import { Bell, Search, User, Sun, Moon, Monitor, Play, Square } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useActivityTracker } from "../contexts/ActivityTrackerContext";

function fmtHMS(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}

export function AppNavbar() {
  const { user, profile } = useAuth();
  const { theme, setTheme, resolvedTheme, lightBrightness, setLightBrightness } = useTheme();
  const { status, elapsed, startWatcher, stopWatcher } = useActivityTracker();
  const [notificationCount, setNotificationCount] = React.useState(0);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const isActive = status === 'active';

  const loadCount = React.useCallback(async () => {
    const uid = user?.uid || profile?.uid;
    if (!uid) return;
    try {
      const res = await fetch(`/api/notifications/unread-count?user_id=${encodeURIComponent(uid)}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotificationCount(Number(data.count || 0));
    } catch {
      // keep navbar quiet if notifications are unavailable
    }
  }, [user?.uid, profile?.uid]);

  const loadNotifications = React.useCallback(async () => {
    const uid = user?.uid || profile?.uid;
    if (!uid) return;
    try {
      const res = await fetch(`/api/notifications?user_id=${encodeURIComponent(uid)}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data);
    } catch (err) {}
  }, [user?.uid, profile?.uid]);

  const markRead = async () => {
    const uid = user?.uid || profile?.uid;
    if (!uid) return;
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid })
      });
      setNotificationCount(0);
    } catch (err) {}
  };

  React.useEffect(() => {
    loadCount();
    const timer = setInterval(loadCount, 15000); // Poll every 15 seconds
    return () => clearInterval(timer);
  }, [loadCount]);

  React.useEffect(() => {
    if (showNotifications) {
      loadNotifications();
      markRead();
    }
  }, [showNotifications, loadNotifications]);

  // Handle click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-8 sticky top-0 z-50">
      <div className="flex items-center gap-4 bg-muted/50 px-4 py-2 rounded-md w-96">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input 
          type="text" 
          placeholder="Search tickets, users..." 
          className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground/70"
        />
      </div>

      <div className="flex items-center gap-4">

        {/* ── Global AI Activity Tracker Toggle ── */}
        {!isActive ? (
          <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all duration-300 bg-muted/40 border-border">
            <button
              id="global-ai-tracker-start"
              onClick={() => startWatcher()}
              title="Start AI Activity Tracker"
              className="flex items-center gap-1.5 text-xs font-semibold text-green-700 hover:text-green-800 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-green-600 text-green-600" />
              <span className="hidden sm:inline">Start Tracker</span>
            </button>
          </div>
        ) : (
          <button
            id="global-ai-tracker-stop"
            onClick={() => stopWatcher()}
            title="Stop AI Activity Tracker"
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Square className="w-3.5 h-3.5 fill-current text-current" />
            <span className="hidden sm:inline">Stop Tracker</span>
          </button>
        )}

        {/* Theme Toggle */}
        {/* Theme Toggle & Brightness Control Container */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme("light")}
              className={`p-1.5 rounded-md transition-colors ${theme === "light" ? "bg-white shadow-sm text-sn-green" : "text-muted-foreground hover:text-foreground"}`}
              title="Light mode"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`p-1.5 rounded-md transition-colors ${theme === "dark" ? "bg-white shadow-sm text-sn-green" : "text-muted-foreground hover:text-foreground"}`}
              title="Dark mode"
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme("system")}
              className={`p-1.5 rounded-md transition-colors ${theme === "system" ? "bg-white shadow-sm text-sn-green" : "text-muted-foreground hover:text-foreground"}`}
              title="System preference"
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>

          {/* Luxury Brightness slider exclusively in Light Mode */}
          {resolvedTheme === "light" && (
            <div className="flex items-center gap-2 border-l border-border pl-2 pr-1.5 animate-in slide-in-from-right duration-250">
              <Sun className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="range"
                min="80"
                max="99"
                value={lightBrightness}
                onChange={(e) => setLightBrightness(Number(e.target.value))}
                className="w-20 h-1 bg-muted-foreground/30 rounded-lg appearance-none cursor-pointer accent-sn-green focus:outline-none"
                title="Adjust background brightness"
              />
            </div>
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative text-muted-foreground hover:text-foreground transition-colors p-1"
            title={notificationCount > 0 ? `${notificationCount} unread notifications` : "Notifications"}
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-destructive text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-sm">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-border rounded-xl shadow-xl z-50 overflow-hidden transform origin-top-right transition-all duration-200">
              <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                <span className="text-sm font-bold">Notifications</span>
                {notifications.length > 0 && (
                  <button onClick={() => setNotifications([])} className="text-[10px] text-muted-foreground hover:text-foreground underline">Clear All</button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <div key={n.id} className={`px-4 py-3 border-b border-border hover:bg-muted/10 transition-colors cursor-default ${!n.is_read ? 'bg-blue-50/30' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.is_read ? 'bg-blue-600' : 'bg-transparent'}`} />
                        <div className="flex-grow">
                          <div className="text-xs font-bold text-foreground mb-0.5">{n.title}</div>
                          <div className="text-[11px] text-muted-foreground leading-relaxed mb-1.5">{n.message}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-muted-foreground uppercase font-medium">{n.ticket_id || 'System'}</span>
                            <span className="text-[9px] text-muted-foreground">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-12 text-center">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs text-muted-foreground">No notifications yet</p>
                  </div>
                )}
              </div>
              <div className="px-4 py-2 bg-muted/20 border-t border-border text-center">
                <button className="text-[10px] font-bold text-blue-600 hover:underline">View All History</button>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3 pl-6 border-l border-border">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold">{profile?.name || "User"}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{profile?.role || "Guest"}</div>
          </div>
          <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
        </div>
      </div>
    </header>
  );
}
