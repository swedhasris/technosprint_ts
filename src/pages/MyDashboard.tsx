import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import AnalyticsCard from "../components/AnalyticsCard";
import PerformanceMetric from "../components/PerformanceMetric";
import AnalyticsChart from "../components/AnalyticsChart";
import RecentActivityList from "../components/RecentActivityList";
import MyTasksList from "../components/MyTasksList";
import QuickActions from "../components/QuickActions";
import { db } from "../lib/firebase";
import { collection, query, onSnapshot, where } from "firebase/firestore";

const MOCK_DATA = {
  cards: { totalAssigned: 0, totalCreated: 0, open: 0, inProgress: 0, resolved: 0, closed: 0, pending: 0, overdue: 0 },
  performance: { completionPercentage: "0%", avgResolutionTime: "N/A", ticketsToday: 0, weekly: "0", monthly: "0", productivityScore: 100 },
  charts: {
    statusDistribution: [
      { name: "Open", value: 1, color: "#3b82f6" }
    ],
    categoryDistribution: [
      { name: "General Support", value: 1, color: "#3b82f6" }
    ],
    trend: [
      { name: "Mon", tickets: 0 },
      { name: "Tue", tickets: 0 },
      { name: "Wed", tickets: 0 },
      { name: "Thu", tickets: 0 },
      { name: "Fri", tickets: 0 },
      { name: "Sat", tickets: 0 },
      { name: "Sun", tickets: 0 }
    ],
    productivity: [
      { name: "Mon", score: 50 },
      { name: "Tue", score: 50 },
      { name: "Wed", score: 50 },
      { name: "Thu", score: 50 },
      { name: "Fri", score: 50 },
      { name: "Sat", score: 50 },
      { name: "Sun", score: 50 }
    ]
  },
  recentActivity: [],
  myTasks: []
};

export function MyDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [breaches, setBreaches] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    const breachesRef = collection(db, "sla_breaches");
    const qBreaches = query(breachesRef, where("assigned_user", "==", user.uid));
    const unsubscribeBreaches = onSnapshot(qBreaches, (snapshot) => {
      const userBreaches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBreaches(userBreaches);
    }, (error) => {
      console.warn("[MyDashboard] Firestore SLA breaches subscription failed (non-fatal):", error.message);
    });

    return unsubscribeBreaches;
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;

    const ticketsRef = collection(db, "tickets");
    const q = query(ticketsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      // Helper to convert Firestore Timestamp / date string / number to Date object
      const toDate = (val: any): Date | null => {
        if (!val) return null;
        if (typeof val === 'object' && val.seconds !== undefined) return new Date(val.seconds * 1000);
        if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate();
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };

      // Filter tickets related to the active user (assigned to them or created by them)
      const userTickets = allTickets.filter(t =>
  t.assignedTo === user.uid || t.assigned_to === user.uid || t.assigned_user === user.uid ||
  t.createdBy === user.uid || t.created_by === user.uid
);
      const assigned = allTickets.filter(t =>
        t.assignedTo === user.uid || t.assigned_to === user.uid || t.assigned_user === user.uid);
      const created = allTickets.filter(t =>
        t.createdBy === user.uid || t.created_by === user.uid);

      // Compute status counts
      const open = userTickets.filter(t => t.status === "New" || t.status === "Open").length;
      const inProgress = userTickets.filter(t => t.status === "In Progress").length;
      const resolved = userTickets.filter(t => t.status === "Resolved").length;
      const closed = userTickets.filter(t => t.status === "Closed").length;
      const pending = userTickets.filter(t => t.status === "Pending" || t.status === "On Hold").length;

      const overdue = userTickets.filter(t => {
        if (t.status === "Resolved" || t.status === "Closed") return false;
        // Mark Critical priority or breached resolution SLA as overdue
        if (t.priority?.includes("Critical")) return true;

        // Also check if resolution deadline exists and is in the past
        if (t.resolutionDeadline) {
          const deadline = toDate(t.resolutionDeadline);
          if (deadline && deadline.getTime() < Date.now()) return true;
        }
        return false;
      }).length;

      // Completion stats
      const totalCount = userTickets.length;
      const completedCount = resolved + closed;
      const completionPercentage = totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}%` : "0%";

      // Calculate avg resolution time
      let totalResMins = 0;
      let resolvedTicketsCount = 0;
      userTickets.forEach(t => {
        const cDate = toDate(t.createdAt);
        const rDate = toDate(t.resolvedAt);
        if (cDate && rDate) {
          const diff = rDate.getTime() - cDate.getTime();
          if (diff > 0) {
            totalResMins += diff / (1000 * 60 * 60);
            resolvedTicketsCount++;
          }
        }
      });
      const avgResolutionTime = resolvedTicketsCount > 0
        ? `${(totalResMins / resolvedTicketsCount).toFixed(1)}h`
        : "N/A";

      // Completed today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const ticketsToday = userTickets.filter(t => {
        const rDate = toDate(t.resolvedAt);
        return rDate && rDate.getTime() >= todayStart.getTime();
      }).length;

      // Weekly / Monthly stats
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const weekly = userTickets.filter(t => {
        const cDate = toDate(t.createdAt);
        return cDate && cDate.getTime() >= oneWeekAgo;
      }).length.toString();
      const monthly = userTickets.filter(t => {
        const cDate = toDate(t.createdAt);
        return cDate && cDate.getTime() >= oneMonthAgo;
      }).length.toString();

      // Productivity score
      const productivityScore = totalCount > 0
        ? Math.min(100, Math.round((completedCount / totalCount) * 80 + 20))
        : 100;

      // Status distribution array
      const statusDistribution = [
        { name: "Open", value: open, color: "#3b82f6" },
        { name: "In Progress", value: inProgress, color: "#f59e0b" },
        { name: "Resolved", value: resolved, color: "#10b981" },
        { name: "Closed", value: closed, color: "#6b7280" },
        { name: "Pending", value: pending, color: "#8b5cf6" },
        { name: "Overdue", value: overdue, color: "#ef4444" }
      ].filter(item => item.value > 0);

      // Category distribution
      const catCounts: Record<string, number> = {};
      userTickets.forEach(t => {
        const cat = t.incidentCategory || t.incident_category || t.category || "Other";
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });
      const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#6b7280", "#8b5cf6", "#ec4899"];
      const categoryDistribution = Object.entries(catCounts).map(([name, value], idx) => ({
        name,
        value,
        color: colors[idx % colors.length]
      }));

      // Weekly trends
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayTickets: Record<string, number> = { "Sun": 0, "Mon": 0, "Tue": 0, "Wed": 0, "Thu": 0, "Fri": 0, "Sat": 0 };
      const dayScores: Record<string, number> = { "Sun": 30, "Mon": 70, "Tue": 85, "Wed": 60, "Thu": 90, "Fri": 75, "Sat": 40 };

      userTickets.forEach(t => {
        const cDate = toDate(t.createdAt);
        if (cDate && cDate.getTime() >= oneWeekAgo) {
          const dayName = days[cDate.getDay()];
          dayTickets[dayName]++;
          dayScores[dayName] = Math.min(100, dayScores[dayName] + 5);
        }
      });

      const trend = days.map(name => ({ name, tickets: dayTickets[name] }));
      const productivity = days.map(name => ({ name, score: dayScores[name] }));

      // Recent Activity list
      const sortedByUpdate = [...userTickets].sort((a, b) => {
        const aTime = toDate(a.updatedAt || a.createdAt)?.getTime() || 0;
        const bTime = toDate(b.updatedAt || b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      });

      const recentActivity = sortedByUpdate.slice(0, 5).map((t, idx) => {
        let action = "Updated";
        let type = "updated";
        if (t.status === "Resolved") {
          action = "Resolved";
          type = "resolved";
        } else if (t.status === "Closed") {
          action = "Closed";
          type = "closed";
        } else if (t.createdBy === user.uid && idx === sortedByUpdate.length - 1) {
          action = "Created";
          type = "created";
        } else if (t.assignedTo === user.uid) {
          action = "Assigned";
          type = "assigned";
        }

        const actTime = toDate(t.updatedAt || t.createdAt);
        return {
          id: t.id,
          title: `${action} ticket #${t.number || 'INC'} - ${t.title || 'Untitled'}`,
          timestamp: actTime ? actTime.toISOString() : new Date().toISOString(),
          type
        };
      });

      // Tasks List
      const myTasks = assigned
        .filter(t => t.status === "New" || t.status === "Open" || t.status === "In Progress")
        .slice(0, 5)
        .map(t => {
          let prio = "medium";
          if (t.priority?.includes("Critical")) prio = "critical";
          else if (t.priority?.includes("High")) prio = "high";
          else if (t.priority?.includes("Low")) prio = "low";

          return {
            id: t.id,
            title: t.title || "Untitled Task",
            status: (t.status === "New" || t.status === "Open") ? "open" : "in_progress",
            priority: prio
          };
        });

      setData({
        allTickets,
        cards: {
          totalAssigned: assigned.length,
          totalCreated: created.length,
          open,
          inProgress,
          resolved,
          closed,
          pending,
          overdue
        },
        performance: {
          completionPercentage,
          avgResolutionTime,
          ticketsToday,
          weekly,
          monthly,
          productivityScore
        },
        charts: {
          statusDistribution: statusDistribution.length > 0 ? statusDistribution : [
            { name: "Open", value: 1, color: "#3b82f6" }
          ],
          categoryDistribution: categoryDistribution.length > 0 ? categoryDistribution : [
            { name: "General Support", value: 1, color: "#3b82f6" }
          ],
          trend,
          productivity
        },
        recentActivity,
        myTasks
      });
    }, (error) => {
      console.error("[MyDashboard] Firestore Query Error:", error);
    });

    return unsubscribe;
  }, [user]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(37,99,235,0.3)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-outfit">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
            Personal Command Console
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Real-time individual performance telemetries & active task controls.</p>
        </div>
        <span className="text-[10px] text-muted-foreground bg-muted/30 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-border/40 font-bold self-start sm:self-auto">
          Operator: <strong className="text-foreground">{user?.email || "User"}</strong>
        </span>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/tickets?filter=assigned_to_me" className="block cursor-pointer">
          <AnalyticsCard title="Total Tickets Assigned" value={data.cards.totalAssigned} />
        </Link>
        <Link to="/tickets?filter=created_by_me" className="block cursor-pointer">
          <AnalyticsCard title="Total Tickets Created" value={data.cards.totalCreated} />
        </Link>
        <Link to="/tickets?filter=open" className="block cursor-pointer">
          <AnalyticsCard title="Open Tickets" value={data.cards.open} />
        </Link>
        <Link to="/tickets?filter=in_progress" className="block cursor-pointer">
          <AnalyticsCard title="In Progress Tickets" value={data.cards.inProgress} />
        </Link>
        <Link to="/tickets?filter=resolved" className="block cursor-pointer">
          <AnalyticsCard title="Resolved Tickets" value={data.cards.resolved} />
        </Link>
        <Link to="/tickets?filter=closed" className="block cursor-pointer">
          <AnalyticsCard title="Closed Tickets" value={data.cards.closed} />
        </Link>
        <Link to="/tickets?filter=pending" className="block cursor-pointer">
          <AnalyticsCard title="Pending Tickets" value={data.cards.pending} />
        </Link>
        <Link to="/tickets?filter=overdue" className="block cursor-pointer">
          <AnalyticsCard title="Overdue Tickets" value={data.cards.overdue} />
        </Link>
        <div className="block cursor-pointer">
          <AnalyticsCard title="Total SLA Breaches" value={breaches.length} />
        </div>
      </div>

      {/* Performance Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <PerformanceMetric label="Ticket Completion %" value={data.performance.completionPercentage} />
        <PerformanceMetric label="Avg Resolution Time" value={data.performance.avgResolutionTime} />
        <PerformanceMetric label="Tickets Completed Today" value={data.performance.ticketsToday} />
        <PerformanceMetric label="Weekly Performance" value={data.performance.weekly} />
        <PerformanceMetric label="Monthly Performance" value={data.performance.monthly} />
        <PerformanceMetric label="Productivity Score" value={data.performance.productivityScore} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnalyticsChart type="pie" title="Ticket Status Distribution" data={data.charts.statusDistribution} />
        <AnalyticsChart type="pie" title="Category Distribution" data={data.charts.categoryDistribution} />
        <AnalyticsChart type="line" title="Ticket Trends (Weekly)" data={data.charts.trend} />
        <AnalyticsChart type="line" title="Productivity & Activity Score" data={data.charts.productivity} />
      </div>

      {/* Bottom Grid: Recent Activity & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivityList items={data.recentActivity} />
        <MyTasksList tasks={data.myTasks} />
      </div>

      {/* SLA Breaches Section */}
      <div className="glass-panel rounded-2xl border border-border/80 p-6 shadow-2xl">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-4 font-outfit">Active SLA Breaches</h2>
        {breaches.length === 0 ? (
          <p className="text-xs text-muted-foreground font-outfit">No active SLA breaches recorded for your assigned incidents.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="p-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground font-outfit">Incident ID</th>
                  <th className="p-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground font-outfit">SLA Protocol</th>
                  <th className="p-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground font-outfit">Overdue Duration</th>
                  <th className="p-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground font-outfit">Severity/Timeslot</th>
                  <th className="p-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground font-outfit">Breach Timestamp</th>
                  <th className="p-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground font-outfit">Current State</th>
                  <th className="p-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground font-outfit">Responsible Tech</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 font-outfit">
                {breaches.map((breach) => {
                  const matchedTicket = data.allTickets?.find((t: any) => t.id === breach.record_id);
                  return (
                    <tr key={breach.id} className="hover:bg-rose-500/5 transition-colors">
                      <td className="p-3">
                        <Link to={`/tickets/${breach.record_id}`} className="font-mono text-xs font-bold text-blue-500 dark:text-blue-400 hover:underline">
                          {matchedTicket?.number || "INC—"}
                        </Link>
                      </td>
                      <td className="p-3 text-xs font-medium text-foreground">{breach.sla_name}</td>
                      <td className="p-3 text-xs text-rose-500 font-bold font-orbitron">{breach.breach_duration}</td>
                      <td className="p-3 text-xs">
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[9px] font-black uppercase tracking-wide">
                          {breach.breach_timeslot}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono">
                        {breach.breach_timestamp ? new Date(breach.breach_timestamp).toLocaleString() : "—"}
                      </td>
                      <td className="p-3 text-xs">
                        <span className="px-2 py-0.5 rounded-lg bg-black/25 text-[9px] font-black uppercase border border-white/5 text-muted-foreground">
                          {matchedTicket?.status || "—"}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{breach.assigned_user_name || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyDashboard;
