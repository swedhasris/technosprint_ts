export const CREATE_INCIDENT_FORM_DEFAULTS = {
  caller: "",
  category: "",
  categoryId: "",
  subcategory: "",
  subcategoryId: "",
  service: "",
  serviceId: "",
  serviceProvider: "",
  serviceOffering: "",
  title: "",
  description: "",
  channel: "Self-service",
  impact: "2 - Medium",
  urgency: "2 - Medium",
  assignmentGroup: "",
  assignedTo: "",
  businessPhone: "",
  location: "",
  configurationItem: "",
  computerName: "",
  knowledgeArticleUsed: false,
  originalAssignmentGroup: "",
  acknowledged: false,
  passwordReset: "No",
  rackspaceTicketNo: "",
  additionalInformation: "",
  affectedUser: "",
  watchList: "",
  company: "",
  selectedGroupId: "",
  customFields: {} as Record<string, string>,
};

export type CreateIncidentFieldKey = keyof typeof CREATE_INCIDENT_FORM_DEFAULTS;

export type CreateIncidentFeatureType = "field" | "button" | "section" | "computed";

export type CreateIncidentFeature = {
  key: string;
  label: string;
  type: CreateIncidentFeatureType;
  fieldKey?: string;
  section?: string;
};

const toLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();

const fieldFeatures: CreateIncidentFeature[] = Object.keys(CREATE_INCIDENT_FORM_DEFAULTS).map((fieldKey) => ({
  key: `field.${fieldKey}`,
  label: toLabel(fieldKey),
  type: "field",
  fieldKey,
}));

const extraFeatures: CreateIncidentFeature[] = [
  { key: "field.number", label: "Number", type: "computed", section: "left_column" },
  { key: "field.priority", label: "Priority", type: "computed", section: "left_column" },
  { key: "field.opened", label: "Opened", type: "computed", section: "right_column" },
  { key: "field.openedBy", label: "Opened By", type: "computed", section: "right_column" },
  { key: "field.state", label: "State", type: "computed", section: "right_column" },
  { key: "field.slaDue", label: "SLA Due", type: "computed", section: "right_column" },
  { key: "button.searchCaller", label: "Reporting User Search", type: "button", section: "left_column" },
  { key: "button.searchAffectedUser", label: "Affected User Search", type: "button", section: "left_column" },
  { key: "button.watchListLookup", label: "Watch List Lookup", type: "button", section: "left_column" },
  { key: "button.locationLookup", label: "Location Lookup", type: "button", section: "left_column" },
  { key: "button.configurationItemLookup", label: "Configuration Item Lookup", type: "button", section: "left_column" },
  { key: "button.computerNameLookup", label: "Computer Name Lookup", type: "button", section: "left_column" },
  { key: "button.assignmentGroupLookup", label: "Assignment Group Lookup", type: "button", section: "right_column" },
  { key: "button.assignedToLookup", label: "Assigned To Lookup", type: "button", section: "right_column" },
  { key: "button.aiAutofill", label: "Autofill With AI", type: "button", section: "full_width" },
  { key: "button.dictation", label: "Dictation", type: "button", section: "full_width" },
  { key: "button.dismissSuggestedSolution", label: "Dismiss Suggested Solution", type: "button", section: "full_width" },
  { key: "button.cancel", label: "Cancel Button", type: "button", section: "footer" },
  { key: "button.submit", label: "Submit Button", type: "button", section: "footer" },
  { key: "section.leftColumn", label: "Left Column", type: "section" },
  { key: "section.rightColumn", label: "Right Column", type: "section" },
  { key: "section.fullWidth", label: "Full Width Fields", type: "section" },
  { key: "section.suggestedSolution", label: "Suggested Solution Box", type: "section" },
  { key: "section.footer", label: "Footer Actions", type: "section" },
];

const featureMap = new Map<string, CreateIncidentFeature>();
[...fieldFeatures, ...extraFeatures].forEach((feature) => {
  featureMap.set(feature.key, feature);
});

export const CREATE_NEW_INCIDENT_FEATURES = Array.from(featureMap.values());

export const CREATE_NEW_INCIDENT_FEATURE_OPTIONS = CREATE_NEW_INCIDENT_FEATURES.map((feature) => ({
  id: feature.key,
  module: "create_new_incident",
  name: feature.label,
  type: feature.type,
  fieldKey: feature.fieldKey || null,
  section: feature.section || null,
}));

export const DEFAULT_COMPANY_FEATURE_PERMISSION = {
  canView: true,
  canUse: true,
  canEdit: true,
  isMandatory: false,
  status: "enabled" as "enabled" | "disabled",
};
