import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Building2, Mail, Phone, Globe, MapPin, Palette, Check, Save, FileSignature, HelpCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyFormProps {
  initialData?: any;
  isEditing?: boolean;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

export function CompanyForm({ initialData, isEditing = false, onSave, onCancel }: CompanyFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    contactName: "",
    phone: "",
    email: "",
    website: "",
    address1: "",
    address2: "",
    city: "",
    province: "",
    postalCode: "",
    country: "",
    logoUrl: "",
    primaryColor: "#0F172A",
    secondaryColor: "#10B981",
    supportSignature: "",
    type: "Customer",
    status: "Active",
    industry: "",
    priorityTier: "Tier 3 - Medium",
    defaultAssignmentGroup: "",
    defaultSlaPolicy: "",
    defaultSupportMailbox: "",
    email_integration_id: ""
  });

  const [emailConfigs, setEmailConfigs] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [draftStatus, setDraftStatus] = useState<"saved" | "saving" | "unsaved" | "idle">("idle");
  const saveTimeoutRef = useRef<any>(null);

  // Load email configs
  useEffect(() => {
    fetch("/api/email-configs")
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        // filter for active config integrations
        setEmailConfigs(data.filter((c: any) => c.is_active));
      })
      .catch(() => setEmailConfigs([]));
  }, []);

  // Populate initial data when editing or load draft when creating
  useEffect(() => {
    if (isEditing && initialData) {
      setFormData({
        name: initialData.name || "",
        contactName: initialData.contactName || "",
        phone: initialData.phone || "",
        email: initialData.email || "",
        website: initialData.website || "",
        address1: initialData.address1 || "",
        address2: initialData.address2 || "",
        city: initialData.city || "",
        province: initialData.province || "",
        postalCode: initialData.postalCode || "",
        country: initialData.country || "",
        logoUrl: initialData.logoUrl || "",
        primaryColor: initialData.primaryColor || "#0F172A",
        secondaryColor: initialData.secondaryColor || "#10B981",
        supportSignature: initialData.supportSignature || "",
        type: initialData.type || "Customer",
        status: initialData.status || "Active",
        industry: initialData.industry || "",
        priorityTier: initialData.priorityTier || "Tier 3 - Medium",
        defaultAssignmentGroup: initialData.defaultAssignmentGroup || "",
        defaultSlaPolicy: initialData.defaultSlaPolicy || "",
        defaultSupportMailbox: initialData.defaultSupportMailbox || "",
        email_integration_id: initialData.email_integration_id || ""
      });
    } else if (!isEditing) {
      const savedDraft = localStorage.getItem("company_create_draft");
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setFormData(prev => ({ ...prev, ...parsed }));
          setDraftStatus("saved");
        } catch (e) {
          console.error("Failed to parse company draft:", e);
        }
      }
    }
  }, [isEditing, initialData]);

  // Handle auto-save draft for Create mode
  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Validation on type
      if (field === "name") {
        if (!value.trim()) {
          setErrors(e => ({ ...e, name: "Company Name is required" }));
        } else {
          setErrors(e => {
            const next = { ...e };
            delete next.name;
            return next;
          });
        }
      }

      if (field === "email_integration_id") {
        if (!value) {
          setErrors(e => ({ ...e, email_integration_id: "Email Integration is required" }));
        } else {
          setErrors(e => {
            const next = { ...e };
            delete next.email_integration_id;
            return next;
          });
        }
      }

      // Auto-save draft logic (only if creating a new company)
      if (!isEditing) {
        setDraftStatus("unsaved");
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        
        saveTimeoutRef.current = setTimeout(() => {
          setDraftStatus("saving");
          localStorage.setItem("company_create_draft", JSON.stringify(updated));
          setTimeout(() => setDraftStatus("saved"), 300);
        }, 800);
      }

      return updated;
    });
  };

  const selectedIntegration = emailConfigs.find(
    c => c.id.toString() === formData.email_integration_id.toString()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final validations
    const nextErrors: Record<string, string> = {};
    if (!formData.name.trim()) nextErrors.name = "Company Name is required";
    if (!formData.email_integration_id) nextErrors.email_integration_id = "Email Integration is required";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      // Scroll to the first error
      const firstErrorKey = Object.keys(nextErrors)[0];
      const element = document.getElementById(firstErrorKey);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      setSuccessMsg(isEditing ? "Company updated successfully." : "Company created successfully.");
      
      // Clear draft on successful create
      if (!isEditing) {
        localStorage.removeItem("company_create_draft");
      }
      
      setTimeout(() => {
        setSuccessMsg("");
      }, 4000);
    } catch (err: any) {
      console.error("Error submitting company form:", err);
      setErrors({ form: err.message || "An error occurred while saving. Please check your inputs." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-16">
      {/* Draft Status Indicator & Top Banner */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <span className="relative flex h-2 w-2">
            <span className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              draftStatus === "unsaved" ? "bg-amber-400" : draftStatus === "saved" ? "bg-emerald-400" : "bg-slate-400"
            )}></span>
            <span className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              draftStatus === "unsaved" ? "bg-amber-500" : draftStatus === "saved" ? "bg-emerald-500" : "bg-slate-500"
            )}></span>
          </span>
          <span>
            {isEditing ? (
              <span className="font-medium text-slate-700">Editing Mode (Auto-save Draft is disabled during editing)</span>
            ) : (
              <span>
                {draftStatus === "saved" && "Draft saved automatically"}
                {draftStatus === "saving" && "Saving draft..."}
                {draftStatus === "unsaved" && "Unsaved changes"}
                {draftStatus === "idle" && "Ready to create"}
              </span>
            )}
          </span>
        </div>
        {!isEditing && draftStatus === "saved" && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Are you sure you want to clear your current draft?")) {
                localStorage.removeItem("company_create_draft");
                setFormData({
                  name: "",
                  contactName: "",
                  phone: "",
                  email: "",
                  website: "",
                  address1: "",
                  address2: "",
                  city: "",
                  province: "",
                  postalCode: "",
                  country: "",
                  logoUrl: "",
                  primaryColor: "#0F172A",
                  secondaryColor: "#10B981",
                  supportSignature: "",
                  type: "Customer",
                  status: "Active",
                  industry: "",
                  priorityTier: "Tier 3 - Medium",
                  defaultAssignmentGroup: "",
                  defaultSlaPolicy: "",
                  defaultSupportMailbox: "",
                  email_integration_id: ""
                });
                setDraftStatus("idle");
              }
            }}
            className="text-red-500 hover:text-red-700 transition-colors font-medium"
          >
            Clear Draft
          </button>
        )}
      </div>

      {/* Success / Error Alerts */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm">Success</p>
            <p className="text-xs text-emerald-700/90">{successMsg}</p>
          </div>
        </div>
      )}

      {errors.form && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
            <span className="font-bold">!</span>
          </div>
          <div>
            <p className="font-bold text-sm">Saving Failed</p>
            <p className="text-xs text-red-700/90">{errors.form}</p>
          </div>
        </div>
      )}

      {/* Form Sections Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* SECTION 1: COMPANY INFORMATION */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Company Information</h3>
                <p className="text-xs text-muted-foreground">General identification and public contact details</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="e.g. Technosprint Ltd"
                  className={cn(
                    "bg-white border-slate-300 text-slate-900 focus-visible:ring-indigo-500",
                    errors.name && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {errors.name && <p className="text-[11px] text-red-500 font-medium mt-1">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contactName" className="text-xs font-semibold text-slate-700">Contact Name</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => handleFieldChange("contactName", e.target.value)}
                  placeholder="Primary representative"
                  className="bg-white border-slate-300 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      placeholder="(555) 123-4567"
                      className="pl-9 bg-white border-slate-300 text-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      placeholder="info@company.com"
                      className="pl-9 bg-white border-slate-300 text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="website" className="text-xs font-semibold text-slate-700">Website URL</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => handleFieldChange("website", e.target.value)}
                    placeholder="https://example.com"
                    className="pl-9 bg-white border-slate-300 text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: EMAIL & COMMUNICATION SETTINGS */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Email & Communication</h3>
                <p className="text-xs text-muted-foreground">Company email integration and mailbox mappings</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email_integration_id" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  Email Integration Mapping <span className="text-red-500">*</span>
                </Label>
                <select
                  id="email_integration_id"
                  value={formData.email_integration_id}
                  onChange={(e) => handleFieldChange("email_integration_id", e.target.value)}
                  className={cn(
                    "w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500",
                    errors.email_integration_id && "border-red-500 focus:ring-red-500"
                  )}
                >
                  <option value="">-- Select Mailbox Integration --</option>
                  {emailConfigs.map(config => (
                    <option key={config.id} value={config.id.toString()}>{config.company_name} ({config.email_address})</option>
                  ))}
                </select>
                {errors.email_integration_id && <p className="text-[11px] text-red-500 font-medium mt-1">{errors.email_integration_id}</p>}
              </div>

              {/* INTEGRATION PREVIEW METADATA PANEL */}
              {selectedIntegration ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3.5 shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Routing Live Metadata
                    </span>
                    <span className="text-[10px] bg-slate-200/60 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                      {selectedIntegration.company_name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-0.5">SMTP Mailbox</span>
                      <p className="font-semibold text-slate-800">{selectedIntegration.email_address}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-0.5">Status</span>
                      <p className={cn(
                        "font-semibold",
                        selectedIntegration.is_active ? "text-emerald-600" : "text-amber-600"
                      )}>
                        {selectedIntegration.is_active ? "Active & Ingesting" : "Suspended"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-0.5">SMTP Server Info</span>
                      <p className="font-semibold text-slate-700 font-mono text-[11px]">
                        {selectedIntegration.smtp_host}:{selectedIntegration.smtp_port}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-0.5">IMAP Server Info</span>
                      <p className="font-semibold text-slate-700 font-mono text-[11px]">
                        {selectedIntegration.imap_host}:{selectedIntegration.imap_port}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center py-6">
                  <Mail className="w-7 h-7 text-slate-400/80 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-500">No Email Integration selected.</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Please map this tenant to exactly one active inbox config.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="defaultSupportMailbox" className="text-xs font-semibold text-slate-700">Default Support Mailbox</Label>
                  <Input
                    id="defaultSupportMailbox"
                    value={formData.defaultSupportMailbox}
                    onChange={(e) => handleFieldChange("defaultSupportMailbox", e.target.value)}
                    placeholder="support@company.com"
                    className="bg-white border-slate-300 text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="defaultAssignmentGroup" className="text-xs font-semibold text-slate-700">Default Assignment Group</Label>
                  <Input
                    id="defaultAssignmentGroup"
                    value={formData.defaultAssignmentGroup}
                    onChange={(e) => handleFieldChange("defaultAssignmentGroup", e.target.value)}
                    placeholder="e.g. Tier 1 Support"
                    className="bg-white border-slate-300 text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: ADDRESS INFORMATION */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Address details</h3>
                <p className="text-xs text-muted-foreground">HQ address or primary billing location</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="address1" className="text-xs font-semibold text-slate-700">Street Address</Label>
                <Input
                  id="address1"
                  value={formData.address1}
                  onChange={(e) => handleFieldChange("address1", e.target.value)}
                  placeholder="123 Main St"
                  className="bg-white border-slate-300 text-slate-900"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address2" className="text-xs font-semibold text-slate-700">Address Line 2</Label>
                <Input
                  id="address2"
                  value={formData.address2}
                  onChange={(e) => handleFieldChange("address2", e.target.value)}
                  placeholder="Suite, Floor, Building"
                  className="bg-white border-slate-300 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-xs font-semibold text-slate-700">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleFieldChange("city", e.target.value)}
                    placeholder="Toronto"
                    className="bg-white border-slate-300 text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="province" className="text-xs font-semibold text-slate-700">State / Province</Label>
                  <Input
                    id="province"
                    value={formData.province}
                    onChange={(e) => handleFieldChange("province", e.target.value)}
                    placeholder="ON"
                    className="bg-white border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="postalCode" className="text-xs font-semibold text-slate-700">Postal / ZIP Code</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => handleFieldChange("postalCode", e.target.value)}
                    placeholder="M9W 8B1"
                    className="bg-white border-slate-300 text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-xs font-semibold text-slate-700">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleFieldChange("country", e.target.value)}
                    placeholder="Canada"
                    className="bg-white border-slate-300 text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: CLASSIFICATION & ADDITIONAL SETTINGS */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Classification & SLA</h3>
                <p className="text-xs text-muted-foreground">Support levels and prioritization defaults</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="type" className="text-xs font-semibold text-slate-700">Company Type</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => handleFieldChange("type", e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Customer">Customer</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Partner">Partner</option>
                    <option value="Internal">Internal</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-xs font-semibold text-slate-700">Status</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => handleFieldChange("status", e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Prospect">Prospect</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="industry" className="text-xs font-semibold text-slate-700">Industry</Label>
                  <Input
                    id="industry"
                    value={formData.industry}
                    onChange={(e) => handleFieldChange("industry", e.target.value)}
                    placeholder="e.g. Technology, Healthcare"
                    className="bg-white border-slate-300 text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="priorityTier" className="text-xs font-semibold text-slate-700">Priority Tier</Label>
                  <select
                    id="priorityTier"
                    value={formData.priorityTier}
                    onChange={(e) => handleFieldChange("priorityTier", e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Tier 1 - Critical">Tier 1 - Critical</option>
                    <option value="Tier 2 - High">Tier 2 - High</option>
                    <option value="Tier 3 - Medium">Tier 3 - Medium</option>
                    <option value="Tier 4 - Low">Tier 4 - Low</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="defaultSlaPolicy" className="text-xs font-semibold text-slate-700">Default SLA Policy</Label>
                <Input
                  id="defaultSlaPolicy"
                  value={formData.defaultSlaPolicy}
                  onChange={(e) => handleFieldChange("defaultSlaPolicy", e.target.value)}
                  placeholder="e.g. Gold 24/7 SLA"
                  className="bg-white border-slate-300 text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* Sticky Bottom Actions Bar (matches ServiceNow / Jira ITSM style) */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 py-4 px-6 -mx-8 shadow-lg flex items-center justify-between z-10">
        <div>
          {errors.name || errors.email_integration_id ? (
            <p className="text-xs text-red-500 font-semibold">Please fix required field errors to submit.</p>
          ) : (
            <p className="text-xs text-slate-500">All fields are validated in real-time.</p>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 shadow-sm"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Save className="w-4 h-4" />
                {isEditing ? "Save Changes" : "Create Company"}
              </span>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

export default CompanyForm;
