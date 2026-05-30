import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Search,
  Phone,
  Mail,
  MapPin,
  Plus,
  ArrowLeft,
  Ticket,
  Clock,
  ChevronRight,
  Globe,
  Edit,
  History,
  Trash2,
  Palette
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyForm } from "../components/CompanyForm";

interface Company {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  logoUrl?: string;
  type?: string;
  status?: string;
  primaryColor?: string;
  secondaryColor?: string;
  supportSignature?: string;
  industry?: string;
  priorityTier?: string;
  defaultAssignmentGroup?: string;
  defaultSlaPolicy?: string;
  defaultSupportMailbox?: string;
  email_integration_id?: string;
  createdAt?: string;
}

interface TicketData {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  company?: string;
}

export function Companies() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { pathname } = useLocation();

  const isCreateView = pathname === "/companies/new";
  const isEditView = pathname.endsWith("/edit");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyTickets, setCompanyTickets] = useState<TicketData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [emailConfigs, setEmailConfigs] = useState<any[]>([]);
  const [companyHistory, setCompanyHistory] = useState<any[]>([]);

  // Delete modal states
  const [deleteCompany, setDeleteCompany] = useState<Company | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deleteCompany) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/companies/${deleteCompany.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setCompanies(prev => prev.filter(c => c.id !== deleteCompany.id));
        setDeleteCompany(null);
        if (id === deleteCompany.id) {
          navigate("/companies");
        }
      } else {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete company");
      }
    } catch (err) {
      console.error(err);
      setDeleteError("Failed to delete company due to a network error.");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetch("/api/email-configs")
      .then(res => res.ok ? res.json() : [])
      .then(data => setEmailConfigs(data))
      .catch(() => setEmailConfigs([]));
  }, []);

  useEffect(() => {
    if (id && !isCreateView) {
      fetchCompanyDetails(id);
    } else {
      setSelectedCompany(null);
      setCompanyTickets([]);
      setCompanyHistory([]);
    }
  }, [id, isCreateView]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      } else {
        throw new Error("Failed to fetch companies");
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyDetails = async (companyId: string) => {
    try {
      const detailRes = await fetch(`/api/companies/${companyId}`);
      if (detailRes.ok) {
        const company = await detailRes.json();
        setSelectedCompany(company);
      } else {
        const company = companies.find(c => c.id === companyId);
        if (company) setSelectedCompany(company);
      }

      const ticketsRes = await fetch(`/api/companies/${companyId}/tickets`);
      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json();
        setCompanyTickets(ticketsData);
      }

      const historyRes = await fetch(`/api/companies/${companyId}/history`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setCompanyHistory(historyData);
      }
    } catch (error) {
      console.error("Error fetching company details:", error);
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active": return "bg-green-500/20 text-green-500";
      case "inactive": return "bg-gray-500/20 text-gray-400";
      case "prospect": return "bg-blue-500/20 text-blue-500";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority?.includes("1") || priority?.toLowerCase().includes("critical")) {
      return "bg-red-500/20 text-red-500";
    } else if (priority?.includes("2") || priority?.toLowerCase().includes("high")) {
      return "bg-orange-500/20 text-orange-500";
    } else if (priority?.includes("3") || priority?.toLowerCase().includes("medium")) {
      return "bg-yellow-500/20 text-yellow-500";
    }
    return "bg-blue-500/20 text-blue-500";
  };

  const openTickets = companyTickets.filter(t => ["Open", "New", "In Progress", "Assigned"].includes(t.status)).length;
  const closedTickets = companyTickets.filter(t => ["Closed", "Resolved"].includes(t.status)).length;
  const activeCount = companies.filter(c => c.status === "Active").length;
  const prospectCount = companies.filter(c => c.status === "Prospect").length;

  const mappedConfig = selectedCompany && emailConfigs.find(
    c => c.id.toString() === selectedCompany.email_integration_id?.toString()
  );

  // Full-page form view logic
  if (isCreateView) {
    return (
      <div className="w-full space-y-6">
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <button onClick={() => navigate("/companies")} className="hover:text-slate-800 flex items-center gap-1 transition-colors">
              <Building2 className="w-3.5 h-3.5" /> Companies
            </button>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-600">Create New Company</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create New Company</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define a new organization tenant, mail routing configurations, and branding templates.</p>
        </div>

        <CompanyForm
          onSave={async (data) => {
            const res = await fetch("/api/companies", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create company");
            const created = await res.json();
            setCompanies(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
            setTimeout(() => navigate(`/companies/${created.id}`), 1200);
          }}
          onCancel={() => navigate("/companies")}
        />
      </div>
    );
  }

  if (isEditView) {
    return (
      <div className="w-full space-y-6">
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <button onClick={() => navigate("/companies")} className="hover:text-slate-800 flex items-center gap-1 transition-colors">
              <Building2 className="w-3.5 h-3.5" /> Companies
            </button>
            {selectedCompany && (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <button onClick={() => navigate(`/companies/${selectedCompany.id}`)} className="hover:text-slate-800 transition-colors">
                  {selectedCompany.name}
                </button>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-600">Edit Company</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit {selectedCompany?.name || "Company"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Modify properties, branding themes, and ticket routing for this company.</p>
        </div>

        {selectedCompany ? (
          <CompanyForm
            initialData={selectedCompany}
            isEditing={true}
            onSave={async (data) => {
              const res = await fetch(`/api/companies/${selectedCompany.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
              });
              if (!res.ok) throw new Error("Failed to update company");
              const updated = await res.json();
              setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? updated : c));
              setSelectedCompany(updated);
              setTimeout(() => navigate(`/companies/${selectedCompany.id}`), 1200);
            }}
            onCancel={() => navigate(`/companies/${selectedCompany.id}`)}
          />
        ) : (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {selectedCompany && id ? (
        <div className="space-y-0">
          {/* Professional Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white -m-8 mb-0 px-8 pt-6 pb-0 shadow-sm border-b border-indigo-900/40">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-white/50 mb-4">
              <button onClick={() => navigate("/companies")} className="hover:text-white flex items-center gap-1 transition-colors">
                <Building2 className="w-3.5 h-3.5" /> Companies
              </button>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white/80">{selectedCompany.name}</span>
            </div>

            {/* Title Row */}
            <div className="flex items-center justify-between pb-5">
              <div className="flex items-center gap-4">
                <button onClick={() => navigate("/companies")} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {selectedCompany.logoUrl ? (
                  <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shadow-lg overflow-hidden border border-slate-200">
                    <img src={selectedCompany.logoUrl} alt={selectedCompany.name} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-lg bg-gradient-to-br from-indigo-500 to-indigo-700"
                  >
                    {selectedCompany.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold">{selectedCompany.name}</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-white/50">{selectedCompany.type || "Customer"}</span>
                    <span className="text-white/20">•</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase", selectedCompany.status === "Active" ? "bg-emerald-500/20 text-emerald-300" : "bg-gray-500/20 text-gray-400")}>
                      {selectedCompany.status || "Active"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white hover:bg-white/10 bg-transparent text-xs"
                  onClick={() => navigate(`/companies/${selectedCompany.id}/edit`)}
                >
                  <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit Company
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-500/50 text-red-400 hover:bg-red-500/10 bg-transparent text-xs"
                  onClick={() => {
                    setDeleteCompany(selectedCompany);
                    setDeleteError(null);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-6">
              {[
                { id: "details", label: "Details", icon: Building2 },
                { id: "tickets", label: "Tickets", icon: Ticket, count: companyTickets.length },
                { id: "history", label: "History", icon: History }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors",
                    activeTab === tab.id ? "border-indigo-400 text-white" : "border-transparent text-white/40 hover:text-white/70"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="bg-white/10 text-white/70 text-[10px] px-1.5 py-0.5 rounded-full">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="pt-6">
            {activeTab === "details" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Card 1: Company Info */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Company Information</h3>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      {[
                        { label: "Company Name", value: selectedCompany.name },
                        { label: "Contact Person", value: selectedCompany.contactName || "—" },
                        { label: "Phone", value: selectedCompany.phone || "—", icon: Phone },
                        { label: "Email", value: selectedCompany.email || "—", icon: Mail },
                        { label: "Website", value: selectedCompany.website || "—", icon: Globe },
                        { label: "Type", value: selectedCompany.type || "Customer" }
                      ].map(field => (
                        <div key={field.label} className="space-y-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{field.label}</p>
                          <div className="flex items-center gap-2">
                            {field.icon && <field.icon className="w-3.5 h-3.5 text-slate-400" />}
                            <p className="text-sm font-semibold text-slate-800">{field.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 2: Address Info */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Address Details</h3>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      {[
                        { label: "Street Address", value: selectedCompany.address1 || "—" },
                        { label: "Address Line 2", value: selectedCompany.address2 || "—" },
                        { label: "City", value: selectedCompany.city || "—" },
                        { label: "Province / State", value: selectedCompany.province || "—" },
                        { label: "Postal Code", value: selectedCompany.postalCode || "—" },
                        { label: "Country", value: selectedCompany.country || "—" },
                      ].map(field => (
                        <div key={field.label} className="space-y-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{field.label}</p>
                          <p className="text-sm font-semibold text-slate-800">{field.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>


                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                  {/* Card 4: Ticket Summary */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-4">Ticket Summary</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Total Tickets</span>
                        <span className="font-bold text-slate-800">{companyTickets.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Open Tickets</span>
                        <span className="font-bold text-orange-500">{openTickets}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Resolved / Closed</span>
                        <span className="font-bold text-emerald-600">{closedTickets}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${companyTickets.length ? (closedTickets / companyTickets.length) * 100 : 0}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-400 text-right font-medium">
                        {companyTickets.length ? Math.round((closedTickets / companyTickets.length) * 100) : 0}% resolution rate
                      </p>
                    </div>
                  </div>

                  {/* Card 5: Classification */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">Classification</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Priority Tier</span>
                        <p className="font-semibold text-slate-800">{selectedCompany.priorityTier || "Tier 3 - Medium"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Industry</span>
                        <p className="font-semibold text-slate-800">{selectedCompany.industry || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Card 6: Email Routing & Integration */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-3.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">Email Routing & SLA</h3>
                    
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">SLA Policy</span>
                        <p className="font-semibold text-slate-800">{selectedCompany.defaultSlaPolicy || "Standard Policy"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Assignment Group</span>
                        <p className="font-semibold text-slate-800">{selectedCompany.defaultAssignmentGroup || "Service Desk"}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Support Mailbox</span>
                        <p className="font-semibold text-slate-800">{selectedCompany.defaultSupportMailbox || "—"}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Integration Config</span>
                      {mappedConfig ? (
                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700 truncate mr-2">{mappedConfig.company_name}</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                          </div>
                          <div className="space-y-1 text-[11px] text-slate-600">
                            <p className="truncate"><span className="font-semibold text-slate-500">Inbox:</span> {mappedConfig.email_address}</p>
                            <p className="font-mono truncate"><span className="font-semibold text-slate-500">SMTP:</span> {mappedConfig.smtp_host}:{mappedConfig.smtp_port}</p>
                            <p className="font-mono truncate"><span className="font-semibold text-slate-500">IMAP:</span> {mappedConfig.imap_host}:{mappedConfig.imap_port}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200/50 p-2.5 rounded-lg">
                          No mailbox integration mapped to this company. Standard ingestion rules apply.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card 7: Quick Actions */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-4">Quick Actions</h3>
                    <div className="space-y-2">
                      <Button
                        className="w-full justify-start bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-0 shadow-none text-xs font-bold"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/tickets?action=new&companyId=${selectedCompany.id}`)}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Create Ticket
                      </Button>
                      <Button
                        className="w-full justify-start text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedCompany.email) {
                            window.location.href = `mailto:${selectedCompany.email}`;
                          } else {
                            alert("No email address provided for this company.");
                          }
                        }}
                      >
                        <Mail className="w-4 h-4 mr-2 text-slate-500" /> Send Email
                      </Button>
                      <Button
                        className="w-full justify-start text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedCompany.phone) {
                            window.location.href = `tel:${selectedCompany.phone}`;
                          } else {
                            alert("No phone number provided for this company.");
                          }
                        }}
                      >
                        <Phone className="w-4 h-4 mr-2 text-slate-500" /> Call Contact
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tickets" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Related Tickets</h3>
                </div>
                {companyTickets.length === 0 ? (
                  <div className="text-center py-12">
                    <Ticket className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No tickets found for this company</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {companyTickets.map(ticket => (
                      <div key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)} className="flex items-center justify-between px-5 py-3.5 hover:bg-indigo-50/20 cursor-pointer transition-colors group">
                        <div className="flex items-center gap-3">
                          <Ticket className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{ticket.title}</p>
                            <p className="text-xs text-slate-400">{ticket.id} • {ticket.createdAt}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", getPriorityColor(ticket.priority))}>{ticket.priority}</span>
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", ["Open", "New"].includes(ticket.status) ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600")}>{ticket.status}</span>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Activity History</h3>
                </div>
                <div className="p-5">
                  <div className="relative pl-6 space-y-6">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
                    {companyHistory.length === 0 ? (
                      <p className="text-sm text-slate-500">No history events recorded yet.</p>
                    ) : (
                      companyHistory.map((event, i) => {
                        let eventTitle = "";
                        let icon = Edit;
                        let color = "bg-indigo-500";
                        
                        if (event.action === "created") {
                          eventTitle = `Company record created: "${event.new_value}"`;
                          icon = Building2;
                          color = "bg-emerald-500";
                        } else if (event.field_name) {
                          const displayName = event.field_name.replace(/_/g, " ");
                          eventTitle = `Updated ${displayName} from "${event.old_value || "none"}" to "${event.new_value || "none"}"`;
                        } else {
                          eventTitle = `Company ${event.action}`;
                        }
                        
                        const IconComponent = icon;
                        return (
                          <div key={event.id || i} className="relative flex items-start gap-3">
                            <div className={cn("absolute -left-6 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white", color)}>
                              <IconComponent className="w-2 h-2 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{eventTitle}</p>
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" /> {new Date(event.timestamp).toLocaleString()} • by {event.user}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Companies</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Manage customer, partner, and vendor organizations</p>
            </div>
            <Button onClick={() => navigate("/companies/new")} className="bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              New Company
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Tenants", value: companies.length, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100" },
              { label: "Active", value: activeCount, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
              { label: "Prospects", value: prospectCount, color: "text-sky-600", bg: "bg-sky-50 border-sky-100" },
              { label: "Inactive", value: companies.length - activeCount - prospectCount, color: "text-slate-500", bg: "bg-slate-50 border-slate-100" },
            ].map(stat => (
              <div key={stat.label} className={cn("rounded-xl border p-4", stat.bg)}>
                <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name, contact, or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-9 text-sm bg-white" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">{filteredCompanies.length} of {companies.length}</span>
          </div>

          {/* Data Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Company</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Contact</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden md:table-cell">Location</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((company) => (
                    <tr key={company.id} onClick={() => navigate(`/companies/${company.id}`)} className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {company.logoUrl ? (
                            <div className="w-9 h-9 rounded bg-white border border-slate-200 flex items-center justify-center p-0.5 shrink-0 overflow-hidden shadow-sm">
                              <img src={company.logoUrl} alt={company.name} className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <div
                              className="w-9 h-9 rounded flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-sm bg-gradient-to-br from-indigo-500 to-indigo-700"
                            >
                              {company.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-sm text-slate-700 group-hover:text-indigo-600 transition-colors">{company.name}</p>
                            {company.email && <p className="text-xs text-slate-400">{company.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-700">{company.contactName || "—"}</p>
                        {company.phone && <p className="text-xs text-slate-400">{company.phone}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-sm text-slate-500">{[company.city, company.province].filter(Boolean).join(", ") || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">{company.type || "Customer"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", getStatusColor(company.status || "Active"))}>{company.status || "Active"}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="icon" className="h-7 w-7 text-indigo-600 border-slate-200 hover:bg-slate-50" onClick={(e) => { e.stopPropagation(); navigate(`/companies/${company.id}/edit`); }}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7 text-red-600 border-red-200 hover:bg-red-50" onClick={(e) => {
                            e.stopPropagation();
                            setDeleteCompany(company);
                            setDeleteError(null);
                          }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCompanies.length === 0 && (
                <div className="text-center py-16">
                  <Building2 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-sm">No companies found</h3>
                  <p className="text-xs text-slate-500 mt-1">Try adjusting your search or create a new company</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCompany && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-base font-bold text-slate-900 mb-2">Delete Company</h3>
              <p className="text-sm text-slate-600 mb-4">
                Are you sure you want to delete: <strong className="text-slate-900 font-bold">{deleteCompany.name}</strong>?
                <br />
                <span className="text-xs text-red-500 font-medium mt-1 block">This action cannot be undone.</span>
              </p>

              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteCompany(null);
                    setDeleteError(null);
                  }}
                  disabled={isDeleting}
                  className="text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Companies;
