import React, { useState, useEffect, useCallback } from "react";
import { BarChart2, ArrowLeft, Bot, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function TimesheetReports() {
  const { user, profile } = useAuth();
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [allCards, setAllCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activitySessions, setActivitySessions] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch timesheets
      const tsRes = await fetch(`/api/timesheets?user_id=${user.uid}`);
      const tsList = await tsRes.json();
      tsList.sort((a: any, b: any) => (b.week_start || "").localeCompare(a.week_start || ""));
      setTimesheets(tsList);

      if (tsList.length === 0) {
        setAllCards([]);
        setLoading(false);
        return;
      }

      // Fetch all cards for the user
      const tcRes = await fetch(`/api/time-cards?user_id=${user.uid}`);
      const cards = await tcRes.json();
      setAllCards(cards);

      // Fetch AI activity sessions
      try {
        const sessRes = await fetch(`/api/activity-sessions?user_id=${user.uid}&limit=20`);
        if (sessRes.ok) setActivitySessions(await sessRes.json());
      } catch { /* silent */ }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalHours = timesheets.reduce((s, t) => s + (parseFloat(t.total_hours) || 0), 0);
  const approvedHours = timesheets.filter(t => t.status === "Approved").reduce((s, t) => s + (parseFloat(t.total_hours) || 0), 0);
  const avgPerWeek = timesheets.length ? totalHours / timesheets.length : 0;

  // Hours by task
  const taskMap: Record<string, number> = {};
  allCards.forEach(c => { 
    const task = c.task || "Unknown";
    taskMap[task] = (taskMap[task] || 0) + (parseFloat(c.hours_worked) || 0); 
  });
  const taskData = Object.entries(taskMap).sort((a, b) => b[1] - a[1]);
  const maxTaskHours = taskData.length ? taskData[0][1] : 1;

  const STATUS_COLORS: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-700",
    Submitted: "bg-blue-100 text-blue-700",
    Approved: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link to="/timesheet" className="p-2 hover:bg-muted rounded transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-sn-dark">Timesheet Reports</h1>
            <p className="text-sm text-muted-foreground">Analytics for your logged minutes</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-sn-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Minutes", value: totalHours.toFixed(0), sub: `${timesheets.length} weeks`, color: "text-sn-dark" },
              { label: "Weekly Average", value: avgPerWeek.toFixed(0), sub: "mins/week", color: "text-blue-600" },
              { label: "Approved Minutes", value: approvedHours.toFixed(0), sub: `${totalHours > 0 ? ((approvedHours / totalHours) * 100).toFixed(0) : 0}% of total`, color: "text-green-600" },
              { label: "Tasks Used", value: taskData.length, sub: "different tasks", color: "text-purple-600" },
            ].map(s => (
              <div key={s.label} className="bg-card rounded-lg border border-border p-5">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{s.label}</div>
                <div className={`text-3xl font-bold mt-2 ${s.color}`}>{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Minutes by Task */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h3 className="font-semibold">Minutes by Ticket Type</h3>
            </div>
            <div className="p-4 space-y-3">
              {taskData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No data yet.</p>
              ) : taskData.map(([task, hrs]) => (
                <div key={task} className="flex items-center gap-4">
                  <div className="w-40 text-sm font-medium truncate">{task}</div>
                  <div className="flex-grow h-4 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-sn-green rounded-full transition-all" style={{ width: `${(hrs / maxTaskHours) * 100}%` }} />
                  </div>
                  <div className="w-20 text-right text-sm font-bold">{hrs.toFixed(0)} mins</div>
                  <div className="w-12 text-right text-xs text-muted-foreground">{totalHours > 0 ? ((hrs / totalHours) * 100).toFixed(0) : 0}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Activity Sessions */}
          {activitySessions.length > 0 && (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-blue-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  <h3 className="font-semibold text-blue-800">AI Activity Tracker Sessions</h3>
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {activitySessions.length}
                  </span>
                </div>
                <Link to="/activity-tracker" className="text-xs text-blue-600 hover:underline font-medium">
                  Open Tracker →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      <th className="p-3 text-left">Date</th>
                      <th className="p-3 text-left">Start</th>
                      <th className="p-3 text-left">End</th>
                      <th className="p-3 text-right">Duration</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-left">Incident</th>
                      <th className="p-3 text-left">Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activitySessions.map((s: any) => {
                      const dur = s.duration || 0;
                      const h = Math.floor(dur / 3600);
                      const m = Math.floor((dur % 3600) / 60);
                      const durStr = dur > 0 ? `${h > 0 ? h + 'h ' : ''}${m}m` : '—';
                      return (
                        <tr key={s.id} className="border-b border-border hover:bg-muted/10">
                          <td className="p-3 text-sm">
                            {s.start_time ? new Date(s.start_time).toLocaleDateString() : '—'}
                          </td>
                          <td className="p-3 text-sm font-mono">
                            {s.start_time ? new Date(s.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-3 text-sm font-mono">
                            {s.stop_time ? new Date(s.stop_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-3 text-right font-bold text-sm">{durStr}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold
                              ${s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {s.status === 'completed' ? 'Completed' : 'Active'}
                            </span>
                          </td>
                          <td className="p-3 text-sm">
                            {s.ticket_number ? (
                              <span className="inline-flex items-center font-mono text-xs font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full">
                                {s.ticket_number}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground max-w-xs truncate">
                            {s.summary || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* AI-tracked time cards summary */}
              {(() => {
                const aiCards = allCards.filter((c: any) => (c.short_description || '').startsWith('[AI Tracked]'));
                const aiMins = aiCards.reduce((s: number, c: any) => s + (parseFloat(c.hours_worked) || 0), 0);
                if (aiCards.length === 0) return null;
                return (
                  <div className="p-3 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs text-blue-700">
                      AI Tracker auto-logged <strong>{aiMins} mins</strong> across <strong>{aiCards.length}</strong> time entries in your timesheets
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Weekly History */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h3 className="font-semibold">Weekly History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="p-3 text-left">Week</th>
                    <th className="p-3 text-right">Total Minutes</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-left">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No records yet.</td></tr>
                  ) : timesheets.map(ts => (
                    <tr key={ts.id} className="border-b border-border hover:bg-muted/10">
                      <td className="p-3 text-sm font-medium">{ts.week_start} → {ts.week_end}</td>
                      <td className="p-3 text-right font-bold">{(parseFloat(ts.total_hours) || 0).toFixed(0)} mins</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[ts.status] || STATUS_COLORS.Draft}`}>{ts.status}</span>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {ts.submitted_at ? new Date(ts.submitted_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
