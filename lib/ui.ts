import { PiiType } from "./types";

export const TYPE_LABEL: Record<PiiType, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  address: "Address",
  dob: "Date of birth",
  ssn: "SSN",
  account: "Account Num",
  financial: "Financial",
  url: "URL",
  org: "Organization",
  job: "Job Title",
  other: "Other",
};

export const PII_TYPES: PiiType[] = [
  "name",
  "phone",
  "email",
  "address",
  "dob",
  "ssn",
  "account",
  "financial",
  "url",
  "org",
  "job",
  "other",
];

export function confidenceLabel(c: number): string {
  if (c >= 0.85) return "High";
  if (c >= 0.7) return "Medium";
  return "Low";
}
