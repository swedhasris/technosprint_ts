import React, { useState, useEffect } from "react";
import { Trophy, Medal, Star, Target, RefreshCw, ShieldCheck, Clock, Zap, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db, firebaseAvailable } from "../lib/firebase";
import { cn } from "../lib/utils";

// Module-level helpers (accessible to all sub-components in this file)
function getInitial(value: string) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toUpperCase() : "?";
}

function getDisplayName(value: any, fallback = "Unassigned") {
  const text = String(value || "").trim();
  return text || fallback;
}

interface SLAStat {
  id: string;
  name: string;
  resolvedCount: number;
  onTimeCount: number;
  breachedCount: number;
  complianceRate: number;
  avgResolutionMinutes: number;
  slaScore: number;
  fastestResolution: number;
}

interface SLAPolicy {
  id: string;
  name: string;
  priority: string;
  category: string;
  resolutionTimeMinutes: number;
}

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<SLAStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [metricTab, setMetricTab] = useState<"performance" | "breaches">("performance");
  const [breachStats, setBreachStats] = useState<any[]>([]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!firebaseAvailable) return;
    const q = query(collection(db, "sla_breaches"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userBreaches: Record<string, { id: string; name: string; count: number; details: any[] }> = {};
      snapshot.docs.forEach((d) => {
        const b = d.data();
        const userId = b.assigned_user || "unassigned";
        const userName = b.assigned_user_name || "Unassigned";
        if (!userBreaches[userId]) {
          userBreaches[userId] = {
            id: userId,
            name: userName,
            count: 0,
            details: []
          };
        }
        userBreaches[userId].count += 1;
        userBreaches[userId].details.push(b);
      });
      const sortedBreaches = Object.values(userBreaches).sort((a, b) => b.count - a.count);
      setBreachStats(sortedBreaches);
    }, (err) => {
      console.error("[Leaderboard] SLA breaches subscription error:", err);
    });
    return unsubscribe;
  }, []);

  const parseDate = (value: any): Date | null => {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    if (typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "object" && value.seconds !== undefined) {
      const date = new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1_000_000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "string") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  };

  const fetchLeaderboard = async () => {
    setError(null);
    // If Firebase is not configured, show empty leaderboard gracefully
    if (!firebaseAvailable) {
      setLeaderboard([]);
      setLastUpdated(new Date());
      setLoading(false);
      return;
    }
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const slaSnapshot = await getDocs(collection(db, "sla_policies"));
      const slaPolicies: SLAPolicy[] = slaSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SLAPolicy[];

      // Fetch all resolved/closed tickets
      const q = query(
        collection(db, "tickets"),
        where("status", "in", ["Resolved", "Closed"])
      );
      const snapshot = await getDocs(q);

      const userStats: { [key: string]: SLAStat } = {};

      snapshot.docs.forEach((doc) => {
        const data = doc.data();

        // Filter to today's resolved tickets
        const resolvedDate = parseDate(data.resolvedAt);
        if (!resolvedDate || resolvedDate < today) return;

        const userId = String(data.assignedTo || "unassigned");
        const userName = getDisplayName(data.assignedToName || data.assignedTo, "Unassigned");

        if (!userStats[userId]) {
          userStats[userId] = {
            id: userId,
            name: userName,
            resolvedCount: 0,
            onTimeCount: 0,
            breachedCount: 0,
            complianceRate: 0,
            avgResolutionMinutes: 0,
            slaScore: 0,
            fastestResolution: Infinity
          };
        }

        const stat = userStats[userId];
        stat.resolvedCount += 1;

        // Calculate resolution time in minutes
        const createdDate = parseDate(data.createdAt);
        const resolvedAt = parseDate(data.resolvedAt);
        let resolutionMinutes = 0;
        if (createdDate && resolvedAt) {
          resolutionMinutes = (resolvedAt.getTime() - createdDate.getTime()) / (1000 * 60);
        }
        if (!Number.isFinite(resolutionMinutes) || resolutionMinutes < 0) {
          resolutionMinutes = 0;
        }

        // Determine SLA target from policy or ticket deadline
        let slaTargetMinutes = 1440; // default (24h)
        const deadline = parseDate(data.resolutionDeadline);
        if (createdDate && deadline) {
          slaTargetMinutes = (deadline.getTime() - createdDate.getTime()) / (1000 * 60);
        } else {
          // Match by priority/category
          const priority = data.priority || "";
          const category = data.category || "";
          const match = slaPolicies.find(p =>
            (p.priority === priority || !p.priority) &&
            (p.category === category || !p.category || p.category === "")
          ) || slaPolicies.find(p => p.priority === priority);
          slaTargetMinutes = match?.resolutionTimeMinutes || 1440;
        }

        // On-time if resolved before deadline
        const isOnTime = data.resolutionSlaStatus === "Completed" &&
          (!deadline || (resolvedAt && resolvedAt <= deadline));
        const isBreached = deadline && resolvedAt && resolvedAt > deadline;

        if (isOnTime && !isBreached) {
          stat.onTimeCount += 1;
        }
        if (isBreached) {
          stat.breachedCount += 1;
        }

        // --- SIMPLE SLA SCORING: 1 minute = 1 point × Priority Multiplier ---
        let ticketScore = 0;

        // Priority multiplier
        const priorityStr = data.priority || "4 - Low";
        let priorityMultiplier = 1;
        if (priorityStr.includes("1")) priorityMultiplier = 2;      // Critical: 2x
        else if (priorityStr.includes("2")) priorityMultiplier = 1.5; // High: 1.5x
        else if (priorityStr.includes("3")) priorityMultiplier = 1;   // Medium: 1x
        else priorityMultiplier = 0.5;                                // Low: 0.5x

        // Base points: resolution minutes × priority multiplier
        ticketScore = Math.round(resolutionMinutes * priorityMultiplier);

        // Breach penalty: 50% reduction if SLA was breached
        if (isBreached) {
          ticketScore = Math.round(ticketScore * 0.5);
        }

        stat.slaScore += ticketScore;

        // Track fastest resolution
        if (resolutionMinutes > 0 && resolutionMinutes < stat.fastestResolution) {
          stat.fastestResolution = resolutionMinutes;
        }

        // Accumulate resolution minutes for average
        stat.avgResolutionMinutes += resolutionMinutes;
      });

      // Finalize stats
      Object.values(userStats).forEach(stat => {
        stat.complianceRate = stat.resolvedCount > 0
          ? Math.round((stat.onTimeCount / stat.resolvedCount) * 100)
          : 0;
        stat.avgResolutionMinutes = stat.resolvedCount > 0
          ? Math.round(stat.avgResolutionMinutes / stat.resolvedCount)
          : 0;
        if (stat.fastestResolution === Infinity) stat.fastestResolution = 0;
      });

      // Sort by SLA score, then compliance rate, then resolved count
      const sorted = Object.values(userStats).sort((a, b) => {
        if (b.slaScore !== a.slaScore) return b.slaScore - a.slaScore;
        if (b.complianceRate !== a.complianceRate) return b.complianceRate - a.complianceRate;
        return b.resolvedCount - a.resolvedCount;
      });

      setLeaderboard(sorted);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error("Leaderboard error:", err);
      setError("Could not load leaderboard. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const displayList = metricTab === "performance" ? leaderboard : breachStats.map(b => ({
    id: b.id,
    name: b.name,
    slaScore: b.count,
    complianceRate: 0,
    resolvedCount: 0,
    onTimeCount: 0,
    breachedCount: b.count
  }));

  // Podium order: 2nd (left), 1st (center), 3rd (right)
  const podiumOrder = [displayList[1], displayList[0], displayList[2]];
  const podiumIndex = [1, 0, 2]; // maps podiumOrder back to rank index
  const getPodiumStyles = (rankIndex: number) => {
    switch (rankIndex) {
      case 0: return { color: "text-yellow-400", border: "border-yellow-400/50", bg: "bg-yellow-400/10", shadow: "shadow-yellow-400/20", glow: "shadow-[0_0_30px_rgba(250,204,21,0.2)]" };
      case 1: return { color: "text-slate-300", border: "border-slate-300/50", bg: "bg-slate-300/10", shadow: "shadow-slate-300/20", glow: "" };
      case 2: return { color: "text-amber-600", border: "border-amber-600/50", bg: "bg-amber-600/10", shadow: "shadow-amber-600/20", glow: "" };
      default: return { color: "text-muted-foreground", border: "border-border", bg: "bg-muted/50", shadow: "", glow: "" };
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <div className="animate-spin rounded-full h-14 w-14 border-4 border-primary/20 border-t-primary" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading today's rankings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4 text-center">
        <div className="p-4 bg-destructive/10 rounded-full">
          <Target className="w-10 h-10 text-destructive" />
        </div>
        <p className="text-destructive font-semibold">{error}</p>
        <button
          onClick={fetchLeaderboard}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <header className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="p-5 bg-yellow-400/10 rounded-full border border-yellow-400/20"
        >
          <Trophy className="w-14 h-14 text-yellow-400" />
        </motion.div>
        <div>
          <h1 className="text-4xl font-black tracking-tight">SLA Performance Leaderboard</h1>
          <p className="text-muted-foreground text-lg mt-1">Rankings powered by SLA compliance &amp; resolution speed</p>
        </div>
        <div className="flex gap-2 p-1 bg-secondary border border-border rounded-xl max-w-sm w-full mt-2 justify-center">
          <button
            onClick={() => setMetricTab("performance")}
            className={cn(
              "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
              metricTab === "performance" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            SLA Performance
          </button>
          <button
            onClick={() => setMetricTab("breaches")}
            className={cn(
              "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
              metricTab === "breaches" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            SLA Breaches
          </button>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 bg-secondary rounded-full text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live · {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading..."}
        </div>
      </header>

      {/* Podium */}
      {displayList.length > 0 ? (
        <div className="grid grid-cols-3 gap-4 items-end pt-14">
          {podiumOrder.map((user, podiumPos) => {
            const rankIdx = podiumIndex[podiumPos];
            if (!user) return <div key={podiumPos} />;
            const styles = getPodiumStyles(rankIdx);
            const isCenter = podiumPos === 1;
            return (
              <PodiumCard
                key={user.id}
                user={user}
                rankIndex={rankIdx}
                styles={styles}
                delay={podiumPos === 1 ? 0 : 0.2}
                isLarge={isCenter}
                isBreaches={metricTab === "breaches"}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 space-y-3">
          <Trophy className="w-16 h-16 text-muted-foreground/20 mx-auto" />
          <p className="text-muted-foreground font-medium text-lg">
            {metricTab === "breaches" ? "No SLA breaches recorded." : "No resolved tickets today yet."}
          </p>
          <p className="text-muted-foreground text-sm">
            {metricTab === "breaches" ? "All active tickets are meeting their SLA targets!" : "Resolve tickets to earn points and appear on the board!"}
          </p>
        </div>
      )}

      {/* Rankings table */}
      {displayList.length > 0 && (
        <div className="bg-card/50 backdrop-blur-md border border-border rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-border bg-muted/50 flex justify-between items-center">
            <h2 className="font-bold flex items-center gap-2">
              <Medal className="w-5 h-5 text-muted-foreground" />
              SLA Rankings
            </h2>
            <div className="flex gap-6 text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {metricTab === "breaches" ? (
                <span>Total Breaches</span>
              ) : (
                <>
                  <span>SLA Score</span>
                  <span>Compliance</span>
                  <span>Resolved</span>
                </>
              )}
            </div>
          </div>

          <div className="divide-y divide-border">
            <AnimatePresence mode="popLayout">
              {displayList.map((user, idx) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.04 }}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                    idx === 0 ? "bg-yellow-400/20 text-yellow-400" :
                    idx === 1 ? "bg-slate-300/20 text-slate-400" :
                    idx === 2 ? "bg-amber-700/20 text-amber-600" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-grow flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center font-bold text-sm text-primary">
                      {getInitial(user.name)}
                    </div>
                    <div>
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {metricTab === "breaches" ? (
                          <span>SLA Breaches</span>
                        ) : (
                          <span>{user.resolvedCount} ticket{user.resolvedCount !== 1 ? "s" : ""} · {user.avgResolutionMinutes}m avg</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {metricTab === "breaches" ? (
                      <div className="flex items-center gap-1 font-bold text-red-500 min-w-[120px] justify-end">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        {user.slaScore} Breaches
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 font-bold text-primary min-w-[60px] justify-end">
                          <Star className="w-4 h-4 fill-primary" />
                          {user.slaScore}
                        </div>
                        <div className={`w-16 text-right font-bold text-sm ${
                          user.complianceRate >= 90 ? "text-green-500" :
                          user.complianceRate >= 70 ? "text-yellow-500" :
                          "text-red-500"
                        }`}>
                          {user.complianceRate}%
                        </div>
                        <div className="w-12 text-right font-mono text-sm text-muted-foreground">
                          {user.resolvedCount}
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatSummary
          icon={<ShieldCheck className="text-green-500 w-5 h-5" />}
          label="Best SLA Compliance"
          value={leaderboard.length > 0
            ? `${leaderboard.reduce((best, curr) => curr.complianceRate > best.complianceRate ? curr : best).complianceRate}%`
            : "N/A"
          }
          subvalue={leaderboard.length > 0
            ? leaderboard.reduce((best, curr) => curr.complianceRate > best.complianceRate ? curr : best).name
            : ""}
        />
        <StatSummary
          icon={<Zap className="text-yellow-500 w-5 h-5" />}
          label="Total SLA Score"
          value={leaderboard.reduce((acc, curr) => acc + curr.slaScore, 0).toLocaleString()}
        />
        <StatSummary
          icon={<Clock className="text-blue-500 w-5 h-5" />}
          label="Team Avg Resolution"
          value={leaderboard.length > 0
            ? `${(leaderboard.reduce((acc, curr) => acc + curr.avgResolutionMinutes, 0) / leaderboard.length).toFixed(0)}m`
            : "0m"
          }
        />
      </div>
    </div>
  );
}

function PodiumCard({
  user, rankIndex, styles, delay, isLarge = false, isBreaches = false
}: {
  user: any;
  rankIndex: number;
  styles: any;
  delay: number;
  isLarge?: boolean;
  isBreaches?: boolean;
  key?: React.Key;
}) {
  const rankLabels = ["🥇 1st", "🥈 2nd", "🥉 3rd"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 120, damping: 14 }}
      className="relative flex flex-col items-center"
    >
      <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${styles.bg} ${styles.color} border ${styles.border} whitespace-nowrap`}>
        {rankLabels[rankIndex]}
      </div>

      <div className={`w-full ${isLarge ? "h-72" : "h-60"} rounded-3xl border ${styles.border} ${styles.bg} flex flex-col justify-end items-center relative overflow-hidden group transition-all duration-300 ${styles.glow}`}>
        {/* Animated shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />

        {/* Rotating ring for #1 */}
        {rankIndex === 0 && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute top-6 w-24 h-24 border-2 border-dashed border-yellow-400/40 rounded-full"
          />
        )}

        <div className={`w-20 h-20 rounded-full ${styles.bg} border-2 ${styles.border} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110 z-10`}>
          <span className={`text-3xl font-black ${styles.color}`}>{getInitial(user.name)}</span>
        </div>

        <div className="text-center pb-6 space-y-2 z-10 px-2">
          <h3 className="font-bold text-base leading-tight truncate max-w-[120px]">{user.name}</h3>

          {/* SLA Score / Breaches */}
          {isBreaches ? (
            <div className="flex items-center justify-center gap-1 font-black text-2xl text-red-500">
              <AlertCircle className="w-5 h-5 text-red-500" />
              {user.slaScore}
            </div>
          ) : (
            <div className={`flex items-center justify-center gap-1 font-black text-2xl ${styles.color}`}>
              <Star className="w-5 h-5 fill-current" />
              {user.slaScore}
            </div>
          )}

          {/* SLA Compliance Badge / Breach Badge */}
          {isBreaches ? (
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-500/20 text-red-400">
              <AlertCircle className="w-3 h-3 text-red-400" />
              SLA Breached
            </div>
          ) : (
            <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              user.complianceRate >= 90 ? "bg-green-500/20 text-green-400" :
              user.complianceRate >= 70 ? "bg-yellow-500/20 text-yellow-400" :
              "bg-red-500/20 text-red-400"
            }`}>
              <ShieldCheck className="w-3 h-3" />
              {user.complianceRate}% SLA
            </div>
          )}

          <div className="text-[11px] text-muted-foreground font-medium space-y-0.5">
            {isBreaches ? (
              <div>{user.breachedCount} breach{user.breachedCount !== 1 ? "es" : ""}</div>
            ) : (
              <>
                <div>{user.resolvedCount} resolved · {user.onTimeCount} on-time</div>
                {user.breachedCount > 0 && (
                  <div className="text-red-400">{user.breachedCount} breached</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatSummary({ icon, label, value, subvalue }: { icon: React.ReactNode; label: string; value: string | number; subvalue?: string }) {
  return (
    <div className="bg-card border border-border p-6 rounded-2xl flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-3 bg-muted rounded-xl shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-xl font-black truncate">{value}</p>
        {subvalue && <p className="text-xs text-muted-foreground truncate">{subvalue}</p>}
      </div>
    </div>
  );
}
