import React, { useEffect, useState } from "react";
import { collection, query, onSnapshot, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { CheckCircle2, Search, Eye, Clock, User, Tag, Download, X } from "lucide-react";
import { Link } from "react-router-dom";
import { cn, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PRIORITY_COLORS: Record<string, string> = {
  "1 - Critical": "bg-red-100 text-red-700",
  "2 - High":     "bg-orange-100 text-orange-700",
  "3 - Moderate": "bg-blue-100 text-blue-700",
  "4 - Low":      "bg-green-100 text-green-700",
};

const STATUS_COLORS: Record<string, string> = {
  "Resolved": "bg-green-100 text-green-700",
  "Closed":   "bg-gray-100 text-gray-700",
};

export function ApprovedTickets() {
  const { user, profile } = useAuth();
  const [tickets, setTickets]   = useState<any[]>([]);
  const [agents, setAgents]     = useState<Record<string, any>>({});
  const [search, setSearch]     = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [loading, setLoading]   = useState(true);

  const [startDate, setStartDate] = useState(() => localStorage.getItem("sn-approved-tickets-start-date") || "");
  const [endDate, setEndDate] = useState(() => localStorage.getItem("sn-approved-tickets-end-date") || "");
  const [appliedStartDate, setAppliedStartDate] = useState(() => localStorage.getItem("sn-approved-tickets-start-date") || "");
  const [appliedEndDate, setAppliedEndDate] = useState(() => localStorage.getItem("sn-approved-tickets-end-date") || "");
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
      localStorage.setItem("sn-approved-tickets-start-date", startDate);
    } else {
      localStorage.removeItem("sn-approved-tickets-start-date");
    }
    if (endDate) {
      localStorage.setItem("sn-approved-tickets-end-date", endDate);
    } else {
      localStorage.removeItem("sn-approved-tickets-end-date");
    }
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setDateError("");
    localStorage.removeItem("sn-approved-tickets-start-date");
    localStorage.removeItem("sn-approved-tickets-end-date");
  };

  const handleExportCSV = () => {
    const headers = ["Number", "Short Description", "Reporting User", "Priority", "Status", "Category", "Assigned To", "Resolved On"];
    const rows = filtered.map(t => {
      const number = t.number || t.id.slice(0, 8);
      const title = t.title || "—";
      const caller = t.caller || "—";
      const priority = t.priority || "4 - Low";
      const status = t.status || "Resolved";
      const category = t.category || "—";
      const assignedUser = agents[t.assignedTo]?.name || "Unassigned";
      
      let resolvedOn = "—";
      const resolvedVal = t.resolvedAt || t.updatedAt;
      if (resolvedVal) {
        if (typeof resolvedVal === 'object' && resolvedVal.seconds !== undefined) {
          resolvedOn = new Date(resolvedVal.seconds * 1000).toLocaleString();
        } else {
          resolvedOn = new Date(resolvedVal).toLocaleString();
        }
      }

      return [
        `"${number.replace(/"/g, '""')}"`,
        `"${title.replace(/"/g, '""')}"`,
        `"${caller.replace(/"/g, '""')}"`,
        `"${priority.replace(/"/g, '""')}"`,
        `"${status.replace(/"/g, '""')}"`,
        `"${category.replace(/"/g, '""')}"`,
        `"${assignedUser.replace(/"/g, '""')}"`,
        `"${resolvedOn.replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `approved_tickets_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (!user) return;
    const isAgent = ["agent","admin","super_admin","ultra_super_admin","sub_admin"].includes(profile?.role || "");

    // Fetch agents for name lookup
    getDocs(collection(db, "users")).then(snap => {
      const map: Record<string, any> = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setAgents(map);
    });

    // Fetch resolved/closed tickets
    let q;
    if (isAgent) {
      q = query(collection(db, "tickets"),
        where("status", "in", ["Resolved", "Closed"]),
        orderBy("updatedAt", "desc")
      );
    } else {
      // Regular users only see their own
      q = query(collection(db, "tickets"),
        where("createdBy", "==", user.uid),
        where("status", "in", ["Resolved", "Closed"]),
        orderBy("updatedAt", "desc")
      );
    }

    return onSnapshot(q, snap => {
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user, profile]);

  const filtered = tickets.filter(t => {
    const matchSearch = !search ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.number?.toLowerCase().includes(search.toLowerCase()) ||
      t.caller?.toLowerCase().includes(search.toLowerCase());
    const matchStatus   = filterStatus === "all"   || t.status === filterStatus;
    const matchPriority = filterPriority === "all" || t.priority === filterPriority;
    
    if (!(matchSearch && matchStatus && matchPriority)) return false;

    const tTime = getRecordTime(t.resolvedAt || t.updatedAt || t.createdAt);
    if (appliedStartDate) {
      const startMs = new Date(appliedStartDate + "T00:00:00").getTime();
      if (tTime < startMs) return false;
    }
    if (appliedEndDate) {
      const endMs = new Date(appliedEndDate + "T23:59:59").getTime();
      if (tTime > endMs) return false;
    }

    return true;
  });

  const resolvedCount = tickets.filter(t => t.status === "Resolved").length;
  const closedCount   = tickets.filter(t => t.status === "Closed").length;

  const priorityBarColors: Record<string, string> = {
    "1 - Critical": "#ef4444",
    "2 - High":     "#f97316",
    "3 - Moderate": "#3b82f6",
    "4 - Low":      "#22c55e",
  };

  const priorityGroups = ["1 - Critical", "2 - High", "3 - Moderate", "4 - Low"].map(p => ({
    name: p.replace(" - ", "\n"),
    label: p.split(" - ")[1],
    fullName: p,
    count: filtered.filter(t => (t.priority || "4 - Low") === p).length,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-sn-dark">Approved / Resolved Tickets</h1>
            <p className="text-sm text-muted-foreground">All resolved and closed incidents</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-xl p-5 flex items-center gap-4">
          <CheckCircle2 className="w-10 h-10 text-green-500 opacity-80" />
          <div>
            <div className="text-3xl font-bold text-green-600">{tickets.length}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Resolved</div>
          </div>
        </div>
        <div className="bg-white border border-green-200 rounded-xl p-5 flex items-center gap-4">
          <CheckCircle2 className="w-10 h-10 text-green-600 opacity-80" />
          <div>
            <div className="text-3xl font-bold text-green-600">{resolvedCount}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Resolved</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
          <CheckCircle2 className="w-10 h-10 text-gray-500 opacity-80" />
          <div>
            <div className="text-3xl font-bold text-gray-600">{closedCount}</div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Closed</div>
          </div>
        </div>
      </div>

      {/* Priority Bar Chart */}
      <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground mb-4">Resolved Tickets by Priority</h3>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priorityGroups} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={10} allowDecimals={false} />
              <YAxis type="category" dataKey="label" fontSize={10} width={70} />
              <Tooltip formatter={(v: any) => [v, "Tickets"]} contentStyle={{ fontSize: 10, borderRadius: 8, border: 'none' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                {priorityGroups.map((entry, i) => (
                  <Cell key={i} fill={priorityBarColors[entry.fullName] || "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-border rounded-lg text-sm w-56 outline-none focus:ring-2 focus:ring-sn-green bg-background text-foreground" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="p-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-sn-green bg-background text-foreground">
            <option value="all">All Status</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="p-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-sn-green bg-background text-foreground">
            <option value="all">All Priorities</option>
            <option value="1 - Critical">Critical</option>
            <option value="2 - High">High</option>
            <option value="3 - Moderate">Moderate</option>
            <option value="4 - Low">Low</option>
          </select>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="p-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-sn-green bg-background text-foreground"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="p-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-sn-green bg-background text-foreground"
            />
            <button
              onClick={handleApplyFilter}
              className="bg-sn-green text-sn-dark px-3 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Apply Filter
            </button>
            {(appliedStartDate || appliedEndDate) && (
              <button
                onClick={handleClearFilter}
                className="p-2 border border-border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Clear Filters"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 border border-border hover:bg-muted bg-white text-foreground font-medium text-sm rounded-lg px-3 py-2 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} tickets</span>
        </div>
        {dateError && (
          <p className="text-red-500 text-xs font-semibold">{dateError}</p>
        )}
      </div>

      {/* Tickets Table */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted/30 border-b border-border text-[10px] font-bold uppercase text-muted-foreground tracking-wide">
                <th className="p-4">Number</th>
                <th className="p-4">Short Description</th>
                <th className="p-4">Reporting User</th>
                <th className="p-4">Priority</th>
                <th className="p-4">Status</th>
                <th className="p-4">Category</th>
                <th className="p-4">Assigned To</th>
                <th className="p-4">Resolved On</th>
                <th className="p-4 text-center">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-sn-green border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-muted-foreground">No resolved tickets found.</p>
                </td></tr>
              ) : filtered.map(t => {
                const priority = t.priority || "4 - Low";
                const status   = t.status   || "Resolved";
                const assignedUser = agents[t.assignedTo] || null;
                return (
                  <tr key={t.id} className="hover:bg-green-50/30 transition-colors">
                    <td className="p-4">
                      <Link to={`/tickets/${t.id}`}
                        className="font-mono text-[11px] font-bold text-blue-600 hover:underline">
                        {t.number || t.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="p-4 text-sm font-medium max-w-[200px] truncate">{t.title || "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3" />
                        {t.caller || "—"}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", PRIORITY_COLORS[priority] || "bg-gray-100 text-gray-700")}>
                        {priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit", STATUS_COLORS[status] || "bg-gray-100 text-gray-700")}>
                        <CheckCircle2 className="w-3 h-3" />
                        {status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3" />
                        {t.category || "—"}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {assignedUser ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-sn-green flex items-center justify-center text-sn-dark text-[10px] font-bold">
                            {(assignedUser.name || "?")[0].toUpperCase()}
                          </div>
                          <span className="text-xs">{assignedUser.name}</span>
                        </div>
                      ) : <span className="italic text-xs">Unassigned</span>}
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {formatDate(t.resolvedAt || t.updatedAt)}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <Link to={`/tickets/${t.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 border border-border rounded-lg hover:bg-muted transition-colors">
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
