import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_HIERARCHY } from "../lib/roles";
import { ShieldAlert, CheckCircle, XCircle, RotateCcw, Eye, X, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  Draft:     "bg-gray-100 text-gray-700",
  Submitted: "bg-blue-100 text-blue-700",
  Approved:  "bg-green-100 text-green-700",
  Rejected:  "bg-red-100 text-red-700",
};

export function TimesheetApprovals() {
  const { profile } = useAuth();
  const role = profile?.role || 'user';
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, any>>({});
  const [statusFilter, setStatusFilter] = useState("Submitted");
  const [viewTs, setViewTs] = useState<any>(null);
  const [viewCards, setViewCards] = useState<any[]>([]);
  const [viewActivities, setViewActivities] = useState<any[]>([]);
  const [viewTab, setViewTab] = useState<"entries" | "screenshots">("entries");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState(() => localStorage.getItem("sn-timesheet-approvals-start-date") || "");
  const [endDate, setEndDate] = useState(() => localStorage.getItem("sn-timesheet-approvals-end-date") || "");
  const [appliedStartDate, setAppliedStartDate] = useState(() => localStorage.getItem("sn-timesheet-approvals-start-date") || "");
  const [appliedEndDate, setAppliedEndDate] = useState(() => localStorage.getItem("sn-timesheet-approvals-end-date") || "");
  const [dateError, setDateError] = useState("");

  const getRecordTime = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'object' && val.seconds !== undefined) {
      return val.seconds * 1000;
    }
    if (typeof val === 'object' && typeof val.toDate === 'function') {
      return val.toDate().getTime();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const handleApplyFilter = () => {
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setDateError("End Date cannot be earlier than Start Date");
      return;
    }
    setDateError("");
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    if (startDate) {
      localStorage.setItem("sn-timesheet-approvals-start-date", startDate);
    } else {
      localStorage.removeItem("sn-timesheet-approvals-start-date");
    }
    if (endDate) {
      localStorage.setItem("sn-timesheet-approvals-end-date", endDate);
    } else {
      localStorage.removeItem("sn-timesheet-approvals-end-date");
    }
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setDateError("");
    localStorage.removeItem("sn-timesheet-approvals-start-date");
    localStorage.removeItem("sn-timesheet-approvals-end-date");
  };

  // Only admin (level 4) and above can approve
  const canApprove = ROLE_HIERARCHY[role as any] >= ROLE_HIERARCHY["admin"];

  const loadData = useCallback(async () => {
    if (!canApprove) return;
    setLoading(true);
    try {
      // Load all users for name lookup
      const usersRes = await fetch("/api/users");
      const usersList = await usersRes.json();
      const map: Record<string, any> = {};
      usersList.forEach((u: any) => { map[u.uid] = u; });
      setUsers(map);

      // Load all timesheets
      const tsRes = await fetch("/api/timesheets/all"); // Assuming there's an endpoint for all timesheets
      const tsList = await tsRes.json();
      setTimesheets(tsList);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [canApprove]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!canApprove) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <ShieldAlert className="w-16 h-16 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground">Ticket approvals require Administrator access or above.</p>
        <p className="text-xs text-muted-foreground">Allowed: Admin · Super Admin · Ultra Super Admin</p>
      </div>
    );
  }

  const filtered = timesheets.filter(ts => {
    const matchStatus = statusFilter === "all" ? true : ts.status === statusFilter;
    if (!matchStatus) return false;

    const tsTime = getRecordTime(ts.submitted_at || ts.created_at);
    if (appliedStartDate) {
      const startMs = new Date(appliedStartDate + "T00:00:00").getTime();
      if (tsTime < startMs) return false;
    }
    if (appliedEndDate) {
      const endMs = new Date(appliedEndDate + "T23:59:59").getTime();
      if (tsTime > endMs) return false;
    }

    return true;
  });

  const counts = {
    Submitted: timesheets.filter(t => t.status === "Submitted").length,
    Approved:  timesheets.filter(t => t.status === "Approved").length,
    Rejected:  timesheets.filter(t => t.status === "Rejected").length,
    Draft:     timesheets.filter(t => t.status === "Draft").length,
  };

  const employeeMinutesMap: Record<string, number> = {};
  filtered.forEach(ts => {
    const user = users[ts.user_id] || {};
    const name = user.name || "Unknown";
    const minutes = parseFloat(ts.total_hours) || 0;
    employeeMinutesMap[name] = (employeeMinutesMap[name] || 0) + minutes;
  });

  const employeeData = Object.entries(employeeMinutesMap).map(([name, minutes]) => ({
    name,
    minutes,
  })).sort((a, b) => b.minutes - a.minutes);

  const handleApprove = async (tsId: string) => {
    if (!confirm("Approve this timesheet?")) return;
    try {
      const res = await fetch(`/api/timesheets/${tsId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: "Approved",
          approved_by: profile?.uid
        })
      });
      if (res.ok) {
        alert("Timesheet Approved Successfully.");
        loadData();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to approve timesheet: ${errData.error || 'Server error'}`);
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while approving the timesheet.");
    }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    try {
      const res = await fetch(`/api/timesheets/${rejectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected", rejection_reason: rejectReason })
      });
      if (res.ok) {
        alert("Timesheet Rejected Successfully.");
        setRejectId(null);
        setRejectReason("");
        setViewTs(null);
        loadData();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to reject timesheet: ${errData.error || 'Server error'}`);
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while rejecting the timesheet.");
    }
  };

  const handleDownloadCSV = () => {
    const filteredTs = filtered;

    const headers = ["Employee Name", "Employee Email", "Week Start", "Week End", "Total Minutes", "Status", "Submitted At"];
    const rows = filteredTs.map(ts => {
      const user = users[ts.user_id] || {};
      const name = user.name || "Unknown";
      const email = user.email || "";
      const weekStart = ts.week_start?.substring?.(0, 10) || "—";
      const weekEnd = ts.week_end?.substring?.(0, 10) || "—";
      const totalMin = (parseFloat(ts.total_hours) || 0).toFixed(0);
      const status = ts.status || "Draft";
      const submitted = ts.submitted_at ? new Date(ts.submitted_at).toLocaleString() : "—";

      return [
        `"${name.replace(/"/g, '""')}"`,
        `"${email.replace(/"/g, '""')}"`,
        `"${weekStart.replace(/"/g, '""')}"`,
        `"${weekEnd.replace(/"/g, '""')}"`,
        totalMin,
        `"${status.replace(/"/g, '""')}"`,
        `"${submitted.replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ticket_approvals_${statusFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (tsId: string) => {
    if (!confirm("Are you sure you want to delete this ticket/timesheet? This will also delete all associated time entries.")) return;
    try {
      const res = await fetch(`/api/timesheets/${tsId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        loadData();
      } else {
        alert("Failed to delete timesheet.");
      }
    } catch (e) {
      console.error(e);
      alert("Error deleting timesheet.");
    }
  };

  const handleReopen = async (tsId: string) => {
    if (!confirm("Reopen this timesheet for editing?")) return;
    try {
      await fetch(`/api/timesheets/${tsId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: "Draft",
          rejection_reason: null
        })
      });
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleView = async (ts: any) => {
    setViewTs(ts);
    setViewTab("entries");
    try {
      // Fetch time cards
      const tcRes = await fetch(`/api/time-cards?timesheet_id=${ts.id}`);
      const cards = await tcRes.json();
      setViewCards(cards);

      // Fetch AI activity snapshots (screenshots)
      const actRes = await fetch(`/api/activity-entries?user_id=${ts.user_id}&start_date=${ts.week_start}&end_date=${ts.week_end}&limit=200`);
      const activities = await actRes.json();
      setViewActivities(activities);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold text-sn-dark">Ticket Approvals</h1>
          <p className="text-sm text-muted-foreground">Review and approve employee tickets</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="p-2 border border-border rounded text-sm outline-none focus:ring-1 focus:ring-sn-green bg-background text-foreground"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="p-2 border border-border rounded text-sm outline-none focus:ring-1 focus:ring-sn-green bg-background text-foreground"
              />
              <Button
                onClick={handleApplyFilter}
                className="bg-sn-green text-sn-dark font-bold text-sm rounded px-3 py-2 hover:opacity-90 transition-opacity"
              >
                Apply Filter
              </Button>
              {(appliedStartDate || appliedEndDate) && (
                <button
                  onClick={handleClearFilter}
                  className="p-2 border border-border rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Clear Filters"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="p-2 border border-border rounded text-sm outline-none focus:ring-1 focus:ring-sn-green bg-background text-foreground">
              <option value="Submitted">Submitted</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Draft">Draft</option>
              <option value="all">All</option>
            </select>

            <Button
              onClick={handleDownloadCSV}
              variant="outline"
              className="flex items-center gap-2 border border-border hover:bg-muted font-medium text-sm rounded p-2 bg-background text-foreground"
            >
              <Download className="w-4 h-4" /> Download CSV
            </Button>
          </div>
          {dateError && (
            <p className="text-red-500 text-xs font-semibold">{dateError}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Pending",  value: counts.Submitted, color: "text-blue-600" },
          { label: "Approved", value: counts.Approved,  color: "text-green-600" },
          { label: "Rejected", value: counts.Rejected,  color: "text-red-600" },
          { label: "Draft",    value: counts.Draft,     color: "text-gray-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-border rounded-lg p-4">
            <div className="text-xs text-muted-foreground uppercase font-bold">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Dynamic Employee Hours Bar Chart */}
      <div className="bg-white border border-border rounded-lg shadow-sm p-5">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground mb-4">Total Minutes Worked by Employee</h3>
        <div className="h-48">
          {employeeData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">
              No timesheet data in range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeData} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} label={{ value: 'Minutes', angle: -90, position: 'insideLeft', offset: 0, style: { fontSize: 10 } }} />
                <Tooltip formatter={(v: any) => [`${v} mins`, "Total Time"]} contentStyle={{ fontSize: 10, borderRadius: 8, border: 'none' }} />
                <Bar dataKey="minutes" fill="#00e676" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/10 text-sm font-bold">
          Tickets ({filtered.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/30 border-b border-border text-[10px] font-bold uppercase text-muted-foreground tracking-wide">
                <th className="p-3">Employee</th>
                <th className="p-3">Week</th>
                <th className="p-3">Total Minutes</th>
                <th className="p-3">Status</th>
                <th className="p-3">Submitted</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No timesheets found.</td></tr>
              ) : filtered.map(ts => {
                const user = users[ts.user_id] || {};
                const status = ts.status || "Draft";
                return (
                  <tr key={ts.id} className="hover:bg-muted/5 transition-colors">
                    <td className="p-3">
                      <div className="font-medium text-sm">{user.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{user.email || ""}</div>
                    </td>
                    <td className="p-3 text-sm">
                      <div>{ts.week_start?.substring?.(0,10) || "—"}</div>
                      <div className="text-xs text-muted-foreground">to {ts.week_end?.substring?.(0,10) || "—"}</div>
                    </td>
                    <td className="p-3 font-bold text-sm">{(parseFloat(ts.total_hours) || 0).toFixed(0)} mins</td>
                    <td className="p-3">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-bold", STATUS_COLORS[status] || STATUS_COLORS.Draft)}>
                        {status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(ts.submitted_at)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleView(ts)} title="View"
                          className="p-1.5 border border-border rounded hover:bg-muted transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {status === "Submitted" && (
                          <>
                            <button onClick={() => handleApprove(ts.id)} title="Approve"
                              className="p-1.5 bg-green-50 border border-green-200 rounded hover:bg-green-100 text-green-700 transition-colors">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setRejectId(ts.id); setRejectReason(""); }} title="Reject"
                              className="p-1.5 bg-red-50 border border-red-200 rounded hover:bg-red-100 text-red-700 transition-colors">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {status === "Rejected" && (
                          <button onClick={() => handleReopen(ts.id)} title="Reopen"
                            className="p-1.5 border border-border rounded hover:bg-muted transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(ts.id)} title="Delete"
                          className="p-1.5 bg-red-50 border border-red-200 rounded hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewTs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setViewTs(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="font-bold">Ticket Details</h3>
              <button onClick={() => setViewTs(null)} className="p-1 hover:bg-muted rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 p-4 rounded-lg">
                <div><span className="text-muted-foreground">Status:</span> <span className={cn("px-2 py-0.5 rounded text-xs font-bold ml-1", STATUS_COLORS[viewTs.status] || "")}>{viewTs.status}</span></div>
                <div><span className="text-muted-foreground">Total:</span> <strong className="ml-1">{(parseFloat(viewTs.total_hours) || 0).toFixed(0)} mins</strong></div>
                <div><span className="text-muted-foreground">Week:</span> <span className="ml-1">{viewTs.week_start?.substring?.(0,10)} → {viewTs.week_end?.substring?.(0,10)}</span></div>
                <div><span className="text-muted-foreground">Submitted:</span> <span className="ml-1">{formatDate(viewTs.submitted_at)}</span></div>
                {viewTs.rejection_reason && <div className="col-span-2 text-red-600"><span className="font-medium">Rejection:</span> {viewTs.rejection_reason}</div>}
              </div>
              <div className="flex border-b border-border mb-4">
                <button onClick={() => setViewTab("entries")}
                  className={cn("px-4 py-2 text-sm font-bold border-b-2 transition-colors", viewTab === "entries" ? "border-sn-green text-sn-dark" : "border-transparent text-muted-foreground")}>
                  Time Entries ({viewCards.length})
                </button>
                <button onClick={() => setViewTab("screenshots")}
                  className={cn("px-4 py-2 text-sm font-bold border-b-2 transition-colors", viewTab === "screenshots" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground")}>
                  AI Evidence ({viewActivities.length})
                </button>
                {viewTs.screenshot_url && (
                  <button onClick={() => setViewTab("submission_screenshot" as any)}
                    className={cn("px-4 py-2 text-sm font-bold border-b-2 transition-colors", viewTab === "submission_screenshot" ? "border-purple-600 text-purple-600" : "border-transparent text-muted-foreground")}>
                    Submission Screenshot
                  </button>
                )}
              </div>

              {viewTab === "entries" ? (
                <div>
                  <table className="w-full text-sm border border-border rounded overflow-hidden">
                    <thead><tr className="bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground">
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Task</th>
                      <th className="p-2 text-right">Minutes</th>
                      <th className="p-2 text-left">Notes</th>
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {viewCards.length === 0 ? (
                        <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No entries</td></tr>
                      ) : viewCards.map(c => (
                        <tr key={c.id}>
                          <td className="p-2">{c.entry_date?.substring?.(0, 10) || "—"}</td>
                          <td className="p-2 font-medium">{c.task || c.taskId || "—"}</td>
                          <td className="p-2 text-right font-bold">{(parseFloat(c.hours_worked) || 0).toFixed(0)}</td>
                          <td className="p-2 text-muted-foreground">{c.description || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : viewTab === "submission_screenshot" ? (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground italic">This screenshot was captured automatically when the user clicked 'Submit'.</p>
                  <div className="border border-border rounded-lg overflow-hidden group cursor-zoom-in" onClick={() => window.open(viewTs.screenshot_url, '_blank')}>
                    <img src={viewTs.screenshot_url} alt="Submission Screenshot" className="w-full h-auto max-h-[500px] object-contain bg-black/5" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {viewActivities.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm italic">No screenshots or AI activity recorded for this period.</div>
                  ) : viewActivities.map((act, i) => (
                    <div key={act.id || i} className="bg-muted/10 border border-border rounded-lg overflow-hidden transition-colors">
                      <div className="flex items-center justify-between p-2 border-b bg-muted/20 border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded uppercase">{act.activity_label || "Active"}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{new Date(act.captured_at).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-[10px] text-muted-foreground">
                            {act.keystrokes} Keys · {act.clicks} Clicks
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 p-3">
                        {act.screenshot_url && (
                          <div className="w-1/3 flex-shrink-0 group relative cursor-zoom-in" onClick={() => window.open(act.screenshot_url, '_blank')}>
                            <img src={act.screenshot_url} alt="Activity" className="w-full h-24 object-cover rounded border border-border" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
                            </div>
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <p className="text-xs text-sn-dark font-medium leading-relaxed mb-1 line-clamp-3 italic">
                            "{act.description || "User was working on system tasks."}"
                          </p>
                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-2">
                               <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                               <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">AI Verified • {Math.round(act.confidence * 100 || 90)}% Confidence</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setRejectId(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-red-50">
              <h3 className="font-bold text-red-700">Reject Ticket</h3>
              <button onClick={() => setRejectId(null)} className="p-1 hover:bg-red-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">Provide a reason — the employee will see this.</p>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full p-2 border border-red-200 rounded text-sm resize-none focus:ring-1 focus:ring-red-400 outline-none" />
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
                <Button onClick={handleReject} disabled={!rejectReason.trim()}
                  className="bg-red-600 text-white hover:bg-red-700">
                  <XCircle className="w-4 h-4 mr-2" /> Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
