import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { 
  Search, SlidersHorizontal, History, Bookmark, ChevronLeft, 
  ChevronRight, FileText, Layers, ShieldAlert, GitBranch, 
  BookOpen, Sparkles, Users, CheckSquare, Trash2, Save, 
  Calendar, User, Plus, X, Tag, AlertCircle, Filter
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  modules: string[];
  filters: {
    status: string;
    priority: string;
    category: string;
    assignee: string;
    startDate: string;
    endDate: string;
  };
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() 
          ? <mark key={i} className="bg-sn-green/30 text-sn-dark dark:text-sn-green font-semibold rounded px-0.5">{part}</mark> 
          : part
      )}
    </>
  );
}

export function GlobalSearch() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";

  // Query state
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTime, setSearchTime] = useState<string | null>(null);

  // Tab views
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);

  // Filters State
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    category: "",
    assignee: "",
    startDate: "",
    endDate: "",
    caller: "",
    subject: "",
    watchList: "",
    dateField: "created",
    hasAttachment: false
  });

  // Sidebar cards state
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("sn-recent-searches") || "[]");
    } catch {
      return [];
    }
  });

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("sn-saved-searches") || "[]");
    } catch {
      return [];
    }
  });

  const isAgentOrAdmin = ["agent", "admin", "super_admin", "ultra_super_admin"].includes(profile?.role || "");

  // Sync searchQuery and filters with URL search parameters
  useEffect(() => {
    const q = searchParams.get("q") || "";
    setSearchQuery(q);

    const searchInVal = searchParams.get("searchIn") || "";
    const categoryVal = searchParams.get("category") || "";
    const callerVal = searchParams.get("caller") || "";
    const assigneeVal = searchParams.get("assignee") || "";
    const subjectVal = searchParams.get("subject") || "";
    const watchListVal = searchParams.get("watchList") || "";
    const priorityVal = searchParams.get("priority") || "";
    const statusVal = searchParams.get("status") || "";
    const dateFieldVal = searchParams.get("dateField") || "created";
    const startDateVal = searchParams.get("startDate") || "";
    const startTimeVal = searchParams.get("startTime") || "00:00";
    const endDateVal = searchParams.get("endDate") || "";
    const endTimeVal = searchParams.get("endTime") || "23:59";
    const hasAttachmentVal = searchParams.get("hasAttachment") === "true";

    // Set selected modules based on searchIn
    let activeModules: string[] = [];
    if (searchInVal && searchInVal !== "all") {
      if (searchInVal === "serviceRequests") {
        activeModules = ["service_requests"];
      } else if (searchInVal === "kbArticles") {
        activeModules = ["kb_articles"];
      } else {
        activeModules = [searchInVal];
      }
    }
    setSelectedModules(activeModules);

    const activeFilters = {
      status: statusVal,
      priority: priorityVal,
      category: categoryVal,
      assignee: assigneeVal,
      startDate: startDateVal ? `${startDateVal}T${startTimeVal}` : "",
      endDate: endDateVal ? `${endDateVal}T${endTimeVal}` : "",
      caller: callerVal,
      subject: subjectVal,
      watchList: watchListVal,
      dateField: dateFieldVal,
      hasAttachment: hasAttachmentVal
    };

    setFilters({
      status: statusVal,
      priority: priorityVal,
      category: categoryVal,
      assignee: assigneeVal,
      startDate: startDateVal,
      endDate: endDateVal,
      caller: callerVal,
      subject: subjectVal,
      watchList: watchListVal,
      dateField: dateFieldVal,
      hasAttachment: hasAttachmentVal
    });

    if (q || searchInVal || categoryVal || callerVal || assigneeVal || subjectVal || watchListVal || priorityVal || statusVal || startDateVal || endDateVal) {
      triggerSearch(q, activeFilters, activeModules);
    }
  }, [searchParams]);

  const triggerSearch = async (qString: string, activeFilters = filters, activeModules = selectedModules) => {
    setLoading(true);
    setSearchTime(null);
    const startTime = performance.now();

    try {
      const res = await fetch("/api/global-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: qString,
          role: profile?.role || "user",
          userId: user?.uid || profile?.uid,
          modules: activeModules,
          filters: {
            status: activeFilters.status,
            priority: activeFilters.priority,
            category: activeFilters.category,
            assignee: activeFilters.assignee,
            caller: activeFilters.caller,
            subject: activeFilters.subject,
            watchList: activeFilters.watchList,
            dateField: activeFilters.dateField,
            hasAttachment: activeFilters.hasAttachment,
            dateRange: {
              start: activeFilters.startDate,
              end: activeFilters.endDate
            }
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);

        // Update local history
        const recent = JSON.parse(localStorage.getItem("sn-recent-searches") || "[]");
        const updated = [qString.trim(), ...recent.filter((s: string) => s !== qString.trim())].slice(0, 8);
        setRecentSearches(updated);
        localStorage.setItem("sn-recent-searches", JSON.stringify(updated));
      }
    } catch (err) {
      console.error("Global search error:", err);
    } finally {
      const endTime = performance.now();
      setSearchTime(((endTime - startTime) / 1000).toFixed(2));
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ q: searchQuery.trim() });
    }
  };

  // Saved Searches Actions
  const handleSaveSearch = () => {
    if (!searchQuery.trim()) return;
    const name = prompt("Enter a name for this saved search:");
    if (!name) return;

    const newSave: SavedSearch = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      query: searchQuery,
      modules: selectedModules,
      filters: { ...filters }
    };

    const updated = [newSave, ...savedSearches];
    setSavedSearches(updated);
    localStorage.setItem("sn-saved-searches", JSON.stringify(updated));
  };

  const handleLoadSavedSearch = (saved: SavedSearch) => {
    setSearchQuery(saved.query);
    setSelectedModules(saved.modules);
    setFilters(saved.filters);
    setSearchParams({ q: saved.query });
  };

  const handleDeleteSavedSearch = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem("sn-saved-searches", JSON.stringify(updated));
  };

  const handleRecentClick = (term: string) => {
    setSearchQuery(term);
    setSearchParams({ q: term });
  };

  const handleDeleteRecent = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== term);
    setRecentSearches(updated);
    localStorage.setItem("sn-recent-searches", JSON.stringify(updated));
  };

  const handleClearHistory = () => {
    setRecentSearches([]);
    localStorage.setItem("sn-recent-searches", "[]");
  };

  const handleModuleToggle = (moduleName: string) => {
    const nextModules = selectedModules.includes(moduleName)
      ? selectedModules.filter(m => m !== moduleName)
      : [...selectedModules, moduleName];
    setSelectedModules(nextModules);
    if (searchQuery.trim()) {
      triggerSearch(searchQuery, filters, nextModules);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    if (searchQuery.trim()) {
      triggerSearch(searchQuery, nextFilters, selectedModules);
    }
  };

  const resetFilters = () => {
    const cleared = {
      status: "",
      priority: "",
      category: "",
      assignee: "",
      startDate: "",
      endDate: "",
      caller: "",
      subject: "",
      watchList: "",
      dateField: "created",
      hasAttachment: false
    };
    setFilters(cleared);
    setSelectedModules([]);
    setSearchParams({ q: searchQuery.trim() });
  };

  // Compile list of matching items for current tab
  const getSelectedTabItems = () => {
    if (!results) return [];
    switch (activeTab) {
      case "incidents": return (results.incidents || []).map((x: any) => ({ ...x, _type: "incident" }));
      case "requests": return (results.serviceRequests || []).map((x: any) => ({ ...x, _type: "serviceRequest" }));
      case "problems": return (results.problems || []).map((x: any) => ({ ...x, _type: "problem" }));
      case "changes": return (results.changes || []).map((x: any) => ({ ...x, _type: "change" }));
      case "kb": return (results.kbArticles || []).map((x: any) => ({ ...x, _type: "kbArticle" }));
      case "assets": return (results.assets || []).map((x: any) => ({ ...x, _type: "asset" }));
      case "users": return (results.users || []).map((x: any) => ({ ...x, _type: "user" }));
      case "tasks": return (results.tasks || []).map((x: any) => ({ ...x, _type: "task" }));
      default:
        return [
          ...(results.incidents || []).map((x: any) => ({ ...x, _type: "incident" })),
          ...(results.serviceRequests || []).map((x: any) => ({ ...x, _type: "serviceRequest" })),
          ...(results.problems || []).map((x: any) => ({ ...x, _type: "problem" })),
          ...(results.changes || []).map((x: any) => ({ ...x, _type: "change" })),
          ...(results.kbArticles || []).map((x: any) => ({ ...x, _type: "kbArticle" })),
          ...(results.assets || []).map((x: any) => ({ ...x, _type: "asset" })),
          ...(results.users || []).map((x: any) => ({ ...x, _type: "user" })),
          ...(results.tasks || []).map((x: any) => ({ ...x, _type: "task" }))
        ];
    }
  };

  const getPath = (item: any, type: string) => {
    switch (type) {
      case "incident":
      case "serviceRequest":
      case "task":
        return `/tickets/${item.id}`;
      case "problem":
        return `/problem`;
      case "change":
        return `/change`;
      case "kbArticle":
        return `/kb`;
      case "asset":
        return `/cmdb`;
      case "user":
        return `/users`;
      default:
        return "/";
    }
  };

  const handleItemClick = (item: any, type: string) => {
    // Save to frequent records
    try {
      const freq = JSON.parse(localStorage.getItem("sn-frequent-records") || "[]");
      const record = { 
        id: item.id, 
        title: item.title || item.name || item.ticket_number || item.id, 
        type, 
        path: getPath(item, type) 
      };
      const updated = [record, ...freq.filter((r: any) => r.id !== item.id || r.type !== type)].slice(0, 5);
      localStorage.setItem("sn-frequent-records", JSON.stringify(updated));
    } catch {}
    
    navigate(getPath(item, type));
  };

  const tabItems = getSelectedTabItems();
  const itemsPerPage = 10;
  const totalPages = Math.ceil(tabItems.length / itemsPerPage) || 1;

  const paginatedItems = useMemo(() => {
    const startIdx = (page - 1) * itemsPerPage;
    return tabItems.slice(startIdx, startIdx + itemsPerPage);
  }, [tabItems, page]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, results]);

  const totalCount = results ? (
    (results.incidents?.length || 0) +
    (results.serviceRequests?.length || 0) +
    (results.problems?.length || 0) +
    (results.changes?.length || 0) +
    (results.kbArticles?.length || 0) +
    (results.assets?.length || 0) +
    (results.users?.length || 0) +
    (results.tasks?.length || 0)
  ) : 0;

  // Tabs structure filtered by Role
  const tabsList = [
    { id: "all", label: "All Results", count: totalCount },
    { id: "incidents", label: "Incidents", count: results?.incidents?.length || 0 },
    { id: "requests", label: "Service Requests", count: results?.serviceRequests?.length || 0 },
    ...(isAgentOrAdmin ? [
      { id: "problems", label: "Problems", count: results?.problems?.length || 0 },
      { id: "changes", label: "Changes", count: results?.changes?.length || 0 }
    ] : []),
    { id: "kb", label: "Knowledge Articles", count: results?.kbArticles?.length || 0 },
    ...(isAgentOrAdmin ? [
      { id: "assets", label: "Assets (CMDB)", count: results?.assets?.length || 0 },
      { id: "users", label: "Users", count: results?.users?.length || 0 }
    ] : []),
    { id: "tasks", label: "My Tasks", count: results?.tasks?.length || 0 }
  ];

  const renderResultItem = (item: any) => {
    const type = item._type;
    let icon = <FileText className="w-5 h-5 text-blue-500" />;
    let typeLabel = "Incident";
    let title = item.title || "";
    let idLabel = item.ticket_number || `INC-${item.id}`;
    let badgeText = item.status;
    let badgeColor = "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900";
    let metaText = `Caller: ${item.caller || 'System'} • Priority: ${item.priority || 'Medium'} • Created: ${item.created_at || item.createdAt ? new Date(item.created_at || item.createdAt).toLocaleDateString() : 'UnknownDate'}`;

    switch (type) {
      case "serviceRequest":
        icon = <Layers className="w-5 h-5 text-green-500" />;
        typeLabel = "Service Request";
        title = item.title || "";
        idLabel = item.ticket_number || `REQ-${item.id}`;
        badgeText = item.status;
        badgeColor = "bg-green-50 text-green-700 border-green-100 dark:bg-green-950 dark:text-green-300 dark:border-green-900";
        metaText = `Caller: ${item.caller || 'System'} • Priority: ${item.priority || 'Medium'} • Created: ${item.created_at || item.createdAt ? new Date(item.created_at || item.createdAt).toLocaleDateString() : 'UnknownDate'}`;
        break;
      case "problem":
        icon = <ShieldAlert className="w-5 h-5 text-red-500" />;
        typeLabel = "Problem";
        title = item.title || "";
        idLabel = item.id;
        badgeText = item.status;
        badgeColor = "bg-red-50 text-red-700 border-red-100 dark:bg-red-950 dark:text-red-300 dark:border-red-900";
        metaText = `Category: ${item.category || 'General'} • Incidents Linked: ${item.incidents || 0}`;
        break;
      case "change":
        icon = <GitBranch className="w-5 h-5 text-purple-500" />;
        typeLabel = "Change Request";
        title = item.title || "";
        idLabel = item.id;
        badgeText = item.state || item.status;
        badgeColor = "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900";
        metaText = `Risk: ${item.risk || 'Medium'} • Category: ${item.category || 'General'}`;
        break;
      case "kbArticle":
        icon = <BookOpen className="w-5 h-5 text-orange-500" />;
        typeLabel = "Knowledge Base";
        title = item.title || "";
        idLabel = "KB";
        badgeText = item.category;
        badgeColor = "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900";
        metaText = `Author: ${item.author} • Views: ${item.views || 0} • Votes: ${item.votes || 0}`;
        break;
      case "asset":
        icon = <Sparkles className="w-5 h-5 text-emerald-500" />;
        typeLabel = "Asset (CMDB)";
        title = item.name || "";
        idLabel = item.id;
        badgeText = item.status;
        badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900";
        metaText = `Type: ${item.type} • Owner: ${item.owner} • Location: ${item.location}`;
        break;
      case "user":
        icon = <Users className="w-5 h-5 text-teal-500" />;
        typeLabel = "User";
        title = item.name || "";
        idLabel = "USER";
        badgeText = item.role;
        badgeColor = "bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900";
        metaText = `Email: ${item.email} • Active: ${item.is_active ? 'Yes' : 'No'}`;
        break;
      case "task":
        icon = <CheckSquare className="w-5 h-5 text-amber-500" />;
        typeLabel = "My Task";
        title = item.title || "";
        idLabel = item.ticket_number || `TASK-${item.id}`;
        badgeText = item.status;
        badgeColor = "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900";
        metaText = `Priority: ${item.priority} • Category: ${item.category}`;
        break;
    }

    return (
      <div 
        key={`${type}-${item.id}`}
        onClick={() => handleItemClick(item, type)}
        className="sn-card hover:border-sn-green dark:hover:border-sn-green hover:shadow-md cursor-pointer transition-all duration-200 border border-border bg-card p-5"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted dark:bg-white/5 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground bg-muted/60 dark:bg-white/10 px-2 py-0.5 rounded">
                {typeLabel}
              </span>
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {idLabel}
              </span>
            </div>
            <h3 className="text-base font-bold mt-1.5 text-sn-dark dark:text-white truncate">
              <Highlight text={title} query={searchQuery} />
            </h3>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                <Highlight text={item.description} query={searchQuery} />
              </p>
            )}
            {item.content && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                <Highlight text={item.content} query={searchQuery} />
              </p>
            )}
            <div className="text-[10px] text-muted-foreground mt-3 flex items-center gap-2 flex-wrap">
              {metaText}
            </div>
          </div>
          {badgeText && (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 capitalize", badgeColor)}>
              {badgeText}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-sn-dark dark:text-white">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light">Search Center</h1>
          <p className="text-muted-foreground text-sm">Enterprise global search engine. Refine results using advanced logic, indexing, and saved templates.</p>
        </div>
        {searchQuery.trim() && (
          <Button 
            onClick={handleSaveSearch}
            className="bg-sn-green text-sn-dark font-bold hover:bg-sn-green/90 shrink-0 self-start md:self-center"
          >
            <Save className="w-4 h-4 mr-2" /> Save Search Template
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Filters Panel */}
        <div className="space-y-6">
          
          {/* Module Selectors */}
          <div className="sn-card space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" /> Modules
            </h3>
            <div className="space-y-2">
              {[
                { key: "tickets", label: "Tickets (Incidents / Requests)" },
                ...(isAgentOrAdmin ? [
                  { key: "problems", label: "Problems" },
                  { key: "changes", label: "Changes" }
                ] : []),
                { key: "kb_articles", label: "Knowledge Articles" },
                ...(isAgentOrAdmin ? [
                  { key: "assets", label: "Assets (CMDB)" },
                  { key: "users", label: "Users" }
                ] : [])
              ].map(mod => (
                <label key={mod.key} className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={selectedModules.includes(mod.key)}
                    onChange={() => handleModuleToggle(mod.key)}
                    className="rounded border-border text-sn-green focus:ring-sn-green w-4 h-4"
                  />
                  <span>{mod.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced Filters */}
          <div className="sn-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Advanced Filters
              </h3>
              <button 
                onClick={resetFilters}
                className="text-[10px] text-sn-green hover:underline font-semibold"
              >
                Reset All
              </button>
            </div>
            
            <div className="space-y-3.5 text-xs">
              {/* Status */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Status</label>
                <select 
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full p-2 border border-border bg-card rounded outline-none focus:ring-1 focus:ring-sn-green"
                >
                  <option value="">-- All Statuses --</option>
                  <option value="New">New</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Priority</label>
                <select 
                  value={filters.priority}
                  onChange={(e) => handleFilterChange("priority", e.target.value)}
                  className="w-full p-2 border border-border bg-card rounded outline-none focus:ring-1 focus:ring-sn-green"
                >
                  <option value="">-- All Priorities --</option>
                  <option value="1 - Critical">1 - Critical</option>
                  <option value="2 - High">2 - High</option>
                  <option value="3 - Medium">3 - Medium</option>
                  <option value="4 - Low">4 - Low</option>
                </select>
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Category</label>
                <input 
                  type="text"
                  placeholder="e.g. Hardware, Network..."
                  value={filters.category}
                  onChange={(e) => handleFilterChange("category", e.target.value)}
                  className="w-full p-2 border border-border bg-card rounded outline-none focus:ring-1 focus:ring-sn-green"
                />
              </div>

              {/* Assignee */}
              {isAgentOrAdmin && (
                <div className="space-y-1">
                  <label className="text-muted-foreground font-medium">Assignee Name / ID</label>
                  <input 
                    type="text"
                    placeholder="Search assignee..."
                    value={filters.assignee}
                    onChange={(e) => handleFilterChange("assignee", e.target.value)}
                    className="w-full p-2 border border-border bg-card rounded outline-none focus:ring-1 focus:ring-sn-green"
                  />
                </div>
              )}

              {/* Caller */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">From (Caller)</label>
                <input 
                  type="text"
                  placeholder="e.g. John Doe"
                  value={filters.caller}
                  onChange={(e) => handleFilterChange("caller", e.target.value)}
                  className="w-full p-2 border border-border bg-card rounded outline-none focus:ring-1 focus:ring-sn-green"
                />
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Subject</label>
                <input 
                  type="text"
                  placeholder="e.g. Printer issue"
                  value={filters.subject}
                  onChange={(e) => handleFilterChange("subject", e.target.value)}
                  className="w-full p-2 border border-border bg-card rounded outline-none focus:ring-1 focus:ring-sn-green"
                />
              </div>

              {/* CC (Watch List) */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">CC (Watch List)</label>
                <input 
                  type="text"
                  placeholder="e.g. manager@org.com"
                  value={filters.watchList}
                  onChange={(e) => handleFilterChange("watchList", e.target.value)}
                  className="w-full p-2 border border-border bg-card rounded outline-none focus:ring-1 focus:ring-sn-green"
                />
              </div>

              {/* Date Field Type */}
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Date Range Field</label>
                <select 
                  value={filters.dateField}
                  onChange={(e) => handleFilterChange("dateField", e.target.value)}
                  className="w-full p-2 border border-border bg-card rounded outline-none focus:ring-1 focus:ring-sn-green"
                >
                  <option value="created">Created Date</option>
                  <option value="updated">Updated Date</option>
                </select>
              </div>

              {/* Date Ranges */}
              <div className="space-y-2">
                <label className="text-muted-foreground font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-muted-foreground">Start</span>
                    <input 
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange("startDate", e.target.value)}
                      className="w-full p-1.5 border border-border bg-card rounded text-[11px] outline-none"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-muted-foreground">End</span>
                    <input 
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange("endDate", e.target.value)}
                      className="w-full p-1.5 border border-border bg-card rounded text-[11px] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={!!filters.hasAttachment}
                    onChange={(e) => handleFilterChange("hasAttachment", e.target.checked)}
                    className="rounded border-border text-sn-green focus:ring-sn-green w-3.5 h-3.5"
                  />
                  <span>Has Attachment / Audit History</span>
                </label>
              </div>
            </div>
          </div>

          {/* Saved Searches */}
          <div className="sn-card space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Bookmark className="w-3.5 h-3.5" /> Saved Searches
            </h3>
            {savedSearches.length === 0 ? (
              <p className="text-xs text-muted-foreground">No saved search templates yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {savedSearches.map(saved => (
                  <div 
                    key={saved.id}
                    onClick={() => handleLoadSavedSearch(saved)}
                    className="flex items-center justify-between p-2 hover:bg-muted/50 dark:hover:bg-white/5 rounded border text-xs cursor-pointer group transition-all animate-in fade-in duration-200"
                  >
                    <span className="font-semibold truncate pr-2" title={saved.name}>{saved.name}</span>
                    <button 
                      onClick={(e) => handleDeleteSavedSearch(e, saved.id)}
                      className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search History */}
          <div className="sn-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <History className="w-3.5 h-3.5" /> Recent Queries
              </h3>
              {recentSearches.length > 0 && (
                <button 
                  onClick={handleClearHistory}
                  className="text-[9px] text-muted-foreground hover:text-red-500 font-semibold"
                >
                  Clear All
                </button>
              )}
            </div>
            {recentSearches.length === 0 ? (
              <p className="text-xs text-muted-foreground">Search history is empty.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                {recentSearches.map((term, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleRecentClick(term)}
                    className="flex items-center justify-between p-2 hover:bg-muted/50 dark:hover:bg-white/5 rounded text-xs cursor-pointer group"
                  >
                    <span className="truncate pr-2">{term}</span>
                    <button 
                      onClick={(e) => handleDeleteRecent(e, term)}
                      className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Search Bar & Results Area */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Main Search Input Form */}
          <form onSubmit={handleSearchSubmit} className="flex gap-3">
            <div className="relative flex-grow group">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-sn-green transition-colors" />
              <input 
                type="text"
                placeholder="Enter search phrase (e.g. system email configuration issues)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-sn-sidebar border border-border rounded-xl py-3 pl-12 pr-4 text-base outline-none focus:ring-1 focus:ring-sn-green transition-all"
              />
            </div>
            <Button 
              type="submit"
              disabled={loading}
              className="bg-sn-green text-sn-dark font-bold hover:bg-sn-green/90 px-6 text-sm py-3 rounded-xl shrink-0"
            >
              {loading ? "Searching..." : "Execute Search"}
            </Button>
          </form>

          {/* Results Status Header */}
          {results && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/80 pb-3 gap-2">
              <div className="text-xs text-muted-foreground">
                Found <span className="font-bold text-foreground">{totalCount}</span> matching records {searchTime && `in ${searchTime}s`}.
              </div>
              {results && (
                <div className="flex gap-2">
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold dark:bg-blue-950 dark:text-blue-300">
                    {results.incidents?.length || 0} Incidents
                  </span>
                  <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold dark:bg-green-950 dark:text-green-300">
                    {results.serviceRequests?.length || 0} Requests
                  </span>
                  {isAgentOrAdmin && (
                    <>
                      <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-bold dark:bg-red-950 dark:text-red-300">
                        {results.problems?.length || 0} Problems
                      </span>
                      <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold dark:bg-purple-950 dark:text-purple-300">
                        {results.changes?.length || 0} Changes
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab Navigation selectors */}
          {results && (
            <div className="flex border-b border-border overflow-x-auto custom-scrollbar py-0.5">
              {tabsList.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all relative flex items-center gap-2",
                    activeTab === tab.id
                      ? "border-sn-green text-sn-green"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                    activeTab === tab.id
                      ? "bg-sn-green/20 text-sn-green"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Results Lists */}
          <div className="space-y-4">
            {loading ? (
              <div className="sn-card p-16 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-sn-green border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Running queries on indexing tables and logs...</p>
              </div>
            ) : results ? (
              paginatedItems.length === 0 ? (
                <div className="sn-card p-16 text-center text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/60 mb-3" />
                  <h3 className="font-bold text-sm text-foreground mb-1">No matches found</h3>
                  <p className="text-xs">Adjust your search keyword or clear active module/advanced filters and try again.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedItems.map(item => renderResultItem(item))}

                  {/* Pagination Controller */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-border pt-4 mt-6">
                      <span className="text-xs text-muted-foreground">
                        Showing {Math.min(tabItems.length, (page - 1) * itemsPerPage + 1)}-{Math.min(tabItems.length, page * itemsPerPage)} of {tabItems.length} records
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === 1}
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          className="px-3 border-border hover:bg-muted"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === totalPages}
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          className="px-3 border-border hover:bg-muted"
                        >
                          Next <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="sn-card p-16 text-center text-muted-foreground space-y-4">
                <Search className="w-12 h-12 mx-auto text-muted-foreground/40" />
                <div>
                  <h3 className="font-bold text-base text-foreground">Welcome to the Search Center</h3>
                  <p className="text-xs max-w-md mx-auto mt-1 leading-relaxed">
                    Query Incidents, Service Requests, Problems, Changes, Tasks, CMDB Assets, Users, and Knowledge Base articles instantly. Supports full-text AND search syntax.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
