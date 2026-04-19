"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, UserPlus, Users, FileSpreadsheet, Trash2, Check } from "lucide-react";
import {
  addDoc, 
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, DonutChart } from "../_components/ui";
import * as XLSX from "xlsx";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  createdAt?: Date | null;
};

type LeadRow = {
  id: string;
  name: string;
  number: string;
  normalizedNumber: string;
  assignedToName: string;
  assignedToEmail: string;
  createdAt: Date | null;
  assignedAt: Date | null;
  location?: string;
  details?: string;
  source?: string;
  status?: string;
  deletedAt?: Date | null;
};

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

function toWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function whatsAppLink(raw: string, text?: string) {
  const wa = toWhatsAppNumber(raw);
  if (!wa) return "";
  const base = `https://wa.me/${encodeURIComponent(wa)}`;
  if (!text) return base;
  return `${base}?text=${encodeURIComponent(text)}`;
}

type WhatsAppTemplate = {
  id: string;
  label: string;
  body: string;
};

const defaultWhatsAppTemplates: WhatsAppTemplate[] = [
  {
    id: "intro",
    label: "Intro Message",
    body: "Hi {name}, this is Clear Lands. Thank you for your interest. Can you share your preferred budget, location, and move-in timeline?",
  },
  {
    id: "follow_up",
    label: "Follow-up",
    body: "Hi {name}, just following up regarding your property requirement. Are you available for a quick call today?",
  },
  {
    id: "schedule",
    label: "Schedule a Call",
    body: "Hi {name}, please share a suitable time for a call today/tomorrow. I’ll confirm and call you as per your convenience.",
  },
  {
    id: "requirements",
    label: "Share Requirements",
    body: "Hi {name}, to suggest the best options, please share: 1) Location 2) Budget 3) BHK/type 4) Ready-to-move or under construction 5) Preferred date.",
  },
];

function renderTemplate(
  tplBody: string,
  lead: Pick<LeadRow, "name" | "number" | "normalizedNumber">,
) {
  const name = lead.name?.trim() ? lead.name.trim() : "there";
  const phone = lead.normalizedNumber || lead.number;
  return tplBody
    .replaceAll("{name}", name)
    .replaceAll("{number}", phone)
    .replaceAll("{phone}", phone);
}

const TEMPLATE_TITLE_MAX_CHARS = 24;
const TEMPLATE_TITLE_MAX_WORDS = 3;

function normalizeTitleInput(raw: string) {
  return raw.replace(/\s+/g, " ").replace(/^\s+/, "");
}

function titleWordCount(raw: string) {
  const t = raw.trim();
  if (!t) return 0;
  return t.split(" ").filter(Boolean).length;
}

function WhatsAppIcon({ size }: { size: number }) {
  const s = size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M26.7 5.3A14.9 14.9 0 0 0 16 1.1C7.8 1.1 1.1 7.8 1.1 16c0 2.6.7 5.1 2 7.4L1 31l7.8-2.1a14.9 14.9 0 0 0 7.2 1.9h.1c8.2 0 14.9-6.7 14.9-14.9 0-4-1.6-7.8-4.3-10.6Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M16 29.1h-.1a13.1 13.1 0 0 1-6.7-1.9l-.5-.3-4.6 1.2 1.2-4.5-.3-.5A13.1 13.1 0 0 1 2.9 16C2.9 8.7 8.7 2.9 16 2.9c3.5 0 6.8 1.4 9.3 3.9A13 13 0 0 1 29.1 16c0 7.3-5.8 13.1-13.1 13.1Z"
        fill="currentColor"
      />
      <path
        d="M23.7 19.5c-.4-.2-2.4-1.2-2.8-1.3-.4-.1-.7-.2-1 .2-.3.4-1.1 1.3-1.3 1.6-.2.2-.4.3-.8.1-.4-.2-1.6-.6-3.1-1.9-1.1-1-1.9-2.2-2.1-2.6-.2-.4 0-.6.1-.8l.6-.7c.2-.2.3-.4.4-.7.1-.2.1-.5 0-.7-.1-.2-1-2.3-1.4-3.1-.4-.8-.7-.7-1-.7h-.9c-.3 0-.7.1-1 .5-.4.4-1.3 1.2-1.3 3 0 1.8 1.3 3.5 1.5 3.7.2.2 2.5 3.8 6.1 5.4.9.4 1.6.7 2.1.9.9.3 1.7.3 2.3.2.7-.1 2.4-1 2.7-2 .3-1 .3-1.9.2-2.1-.1-.2-.4-.3-.8-.5Z"
        fill="#ffffff"
      />
    </svg>
  );
}

function normalizeSourceName(source: string | undefined): string {
  if (!source) return "";
  const sourceLower = source.toLowerCase().trim();
  
  // Check for 99acres variations first
  if (sourceLower.includes("99") || sourceLower.includes("99acres") || sourceLower.includes("99 acres") || sourceLower.includes("99acre")) {
    return "99acres";
  }
  
  // Check for MagicBricks variations
  if (sourceLower === "mb" || sourceLower.includes("magicbricks") || sourceLower.includes("magic bricks") || sourceLower.includes("magicbrick")) {
    return "MagicBricks";
  }
  
  // Check for OLX
  if (sourceLower.includes("olx")) {
    return "OLX";
  }
  
  // Check for other sources
  if (sourceLower.includes("housing") || sourceLower.includes("housing.com")) {
    return "Housing.com";
  }
  if (sourceLower.includes("commonfloor") || sourceLower.includes("common floor")) {
    return "CommonFloor";
  }
  if (sourceLower.includes("proptiger") || sourceLower.includes("prop tiger")) {
    return "PropTiger";
  }
  if (sourceLower.includes("facebook") || sourceLower.includes("fb")) {
    return "Facebook";
  }
  if (sourceLower.includes("instagram") || sourceLower.includes("insta")) {
    return "Instagram";
  }
  if (sourceLower.includes("whatsapp") || sourceLower.includes("wa")) {
    return "WhatsApp";
  }
  if (sourceLower.includes("google")) {
    return "Google";
  }
  if (sourceLower.includes("justdial")) {
    return "Justdial";
  }
  if (sourceLower.includes("sulekha")) {
    return "Sulekha";
  }
  if (sourceLower.includes("quikr")) {
    return "Quikr";
  }
  if (sourceLower.includes("direct") || sourceLower.includes("referral")) {
    return "Direct/Referral";
  }
  if (sourceLower.includes("website") || sourceLower.includes("web")) {
    return "Website";
  }
  if (sourceLower.includes("cold call")) {
    return "Cold Call";
  }
  if (sourceLower.includes("walk") || sourceLower.includes("walk-in")) {
    return "Walk-in";
  }
  if (sourceLower.includes("exhibition") || sourceLower.includes("expo")) {
    return "Exhibition";
  }
  
  // If no match, return original
  return source;
}

function parseLeadLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const csv = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if (csv.length >= 2) {
    // Last item is always the number, second to last could be source, rest is name
    const number = csv[csv.length - 1] ?? "";
    const source = csv.length >= 3 ? csv[csv.length - 2] ?? "" : "";
    const name = csv.slice(0, csv.length - (source ? 2 : 1)).join(", ").trim();
    return { name, number, source };
  }
  const match = trimmed.match(/^(.*?)(?:\s*[-–—:]\s*|\s+)(\+?\d[\d\s().-]{6,})$/);
  if (match) return { name: (match[1] ?? "").trim(), number: (match[2] ?? "").trim(), source: "" };
  return { name: "", number: trimmed, source: "" };
}

function pickAssignee(
  staff: { email: string; name: string }[],
  countsByEmail: Map<string, number>,
) {
  const ordered = [...staff].sort((a, b) => a.email.localeCompare(b.email));
  let best = ordered[0] ?? null;
  let bestCount = best ? countsByEmail.get(best.email) ?? 0 : Number.POSITIVE_INFINITY;
  for (const s of ordered) {
    const c = countsByEmail.get(s.email) ?? 0;
    if (c < bestCount) {
      best = s;
      bestCount = c;
    }
  }
  return best;
}

export default function LeadsPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [staffEmailFilter, setStaffEmailFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const [openAdd, setOpenAdd] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);

  const [leadName, setLeadName] = useState("");
  const [leadNumber, setLeadNumber] = useState("");
  const [leadLocation, setLeadLocation] = useState("");
  const [leadDetails, setLeadDetails] = useState("");
  const [leadSource, setLeadSource] = useState("");

  const [uploadText, setUploadText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    added: number;
    skipped: number;
    invalid: number;
  } | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelResults, setExcelResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });
  const [uploadAssignmentMode, setUploadAssignmentMode] = useState<"auto" | "specific">("auto");
  const [uploadSelectedEmployees, setUploadSelectedEmployees] = useState<string[]>([]);
  const [addLeadAssignmentMode, setAddLeadAssignmentMode] = useState<"auto" | "specific">("auto");
  const [addLeadSelectedEmployee, setAddLeadSelectedEmployee] = useState<string>("");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [selectedEmployeeForAllocation, setSelectedEmployeeForAllocation] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [waMenu, setWaMenu] = useState<{
    lead: LeadRow;
    x: number;
    y: number;
  } | null>(null);
  const waMenuRef = useRef<HTMLDivElement | null>(null);

  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>(
    defaultWhatsAppTemplates,
  );
  const [openWaTemplates, setOpenWaTemplates] = useState(false);
  const [tplLabel, setTplLabel] = useState("");
  const [tplBody, setTplBody] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setSearch(q);
    const staff = params.get("staff");
    if (staff) setStaffEmailFilter(staff.trim().toLowerCase());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t) return;
      if (waMenuRef.current && waMenuRef.current.contains(t)) return;
      if (t.closest('[data-wa-button="true"]')) return;
      setWaMenu(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("clearlands_wa_templates");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const cleaned: WhatsAppTemplate[] = parsed
        .map((t) => {
          const obj = t as { id?: unknown; label?: unknown; body?: unknown };
          return {
            id: String(obj.id ?? ""),
            label: String(obj.label ?? ""),
            body: String(obj.body ?? ""),
          };
        })
        .filter((t) => t.id && t.label && t.body);
      if (cleaned.length) setWaTemplates(cleaned);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("clearlands_wa_templates", JSON.stringify(waTemplates));
  }, [waTemplates]);

  useEffect(() => {
    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows: StaffRow[] = snap.docs.map((d) => {
          const data = d.data() as {
            name?: string;
            email?: string;
            createdAt?: { toDate?: () => Date } | null;
          };
          return {
            id: d.id,
            name: data.name ?? "",
            email: data.email ?? "",
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          };
        });
        setStaff(rows);
      },
      () => setStaff([]),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "call_numbers"), orderBy("createdAt", "desc"), limit(2000));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows: LeadRow[] = snap.docs.map((d) => {
          const data = d.data() as {
            name?: string;
            number?: string;
            normalizedNumber?: string;
            assignedToName?: string;
            assignedToEmail?: string;
            createdAt?: { toDate?: () => Date } | null;
            assignedAt?: { toDate?: () => Date } | null;
            location?: string;
            details?: string;
            source?: string;
            status?: string;
            deletedAt?: { toDate?: () => Date } | null;
          };
          return {
            id: d.id,
            name: data.name ?? "",
            number: data.number ?? "",
            normalizedNumber: data.normalizedNumber ?? "",
            assignedToName: data.assignedToName ?? "",
            assignedToEmail: String(data.assignedToEmail ?? "").trim().toLowerCase(),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
            assignedAt: data.assignedAt?.toDate ? data.assignedAt.toDate() : null,
            location: data.location ?? "",
            details: data.details ?? "",
            source: data.source ?? "",
            status: data.status ?? "",
            deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate() : null,
          };
        });
        setLeads(rows);
        setLoading(false);
      },
      () => {
        setLeads([]);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const staffOptions = useMemo(() => {
    return staff
      .filter((s) => Boolean(s.email))
      .map((s) => ({
        email: s.email.trim().toLowerCase(),
        name: s.name ?? "",
        label: s.name ? `${s.name} (${s.email})` : s.email,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [staff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      // Exclude deleted leads from main view
      if (l.status === "deleted") return false;

      if (staffEmailFilter !== "all" && l.assignedToEmail !== staffEmailFilter) return false;
      if (sourceFilter !== "all") {
        const normalizedSource = normalizeSourceName(l.source);
        if (!normalizedSource || normalizedSource !== sourceFilter) return false;
      }
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.number.toLowerCase().includes(q) ||
        l.normalizedNumber.toLowerCase().includes(q) ||
        l.assignedToName.toLowerCase().includes(q) ||
        l.assignedToEmail.toLowerCase().includes(q) ||
        (l.location && l.location.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q)) ||
        (l.source && l.source.toLowerCase().includes(q))
      );
    });
  }, [leads, search, staffEmailFilter, sourceFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }, [filtered, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, staffEmailFilter, sourceFilter]);

  const totalLeads = leads.length;

  const countsByStaff = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) {
      const email = l.assignedToEmail || "unassigned";
      map.set(email, (map.get(email) ?? 0) + 1);
    }
    return map;
  }, [leads]);

  const countsBySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) {
      const source = normalizeSourceName(l.source) || "Unknown";
      map.set(source, (map.get(source) ?? 0) + 1);
    }
    return map;
  }, [leads]);

  const staffChartItems = useMemo(() => {
    const colors = [
      "rgba(16,185,129,0.95)",
      "rgba(59,130,246,0.95)",
      "rgba(245,158,11,0.95)",
      "rgba(139,92,246,0.95)",
      "rgba(244,63,94,0.9)",
      "rgba(15,23,42,0.75)",
    ];

    return staffOptions.map((s, i) => {
      const value = countsByStaff.get(s.email) ?? 0;
      const color = colors[i % colors.length]!;
      return {
        email: s.email,
        name: s.name,
        label: s.name || s.email,
        fullLabel: s.label,
        value,
        color,
      };
    });
  }, [countsByStaff, staffOptions]);

  const donutSegments = useMemo(() => {
    const nonZero = staffChartItems.filter((i) => i.value > 0);
    if (!nonZero.length)
      return [{ value: 1, color: "rgba(148,163,184,0.25)", label: "No Data" }];
    return nonZero.map((i) => ({ value: i.value, color: i.color, label: i.label }));
  }, [staffChartItems]);

  const topStaff = useMemo(() => {
    const rows = [...staffChartItems].sort((a, b) => b.value - a.value);
    return rows.slice(0, 8);
  }, [staffChartItems]);

  const sourceChartItems = useMemo(() => {
    const colors = [
      "rgba(16,185,129,0.95)",
      "rgba(59,130,246,0.95)",
      "rgba(245,158,11,0.95)",
      "rgba(139,92,246,0.95)",
      "rgba(244,63,94,0.9)",
      "rgba(15,23,42,0.75)",
      "rgba(236,72,153,0.9)",
      "rgba(20,184,166,0.9)",
    ];

    return Array.from(countsBySource.entries()).map(([source, count], i) => {
      const color = colors[i % colors.length]!;
      return {
        source,
        value: count,
        color,
      };
    });
  }, [countsBySource]);

  const sourceDonutSegments = useMemo(() => {
    const nonZero = sourceChartItems.filter((i) => i.value > 0);
    if (!nonZero.length)
      return [{ value: 1, color: "rgba(148,163,184,0.25)", label: "No Data" }];
    return nonZero.map((i) => ({ value: i.value, color: i.color, label: i.source }));
  }, [sourceChartItems]);

  async function addOneLead(payload: { name: string; number: string; location?: string; details?: string; source?: string; specificEmployee?: { email: string; name: string } }) {
    const staffList = staffOptions.map((s) => ({ email: s.email, name: s.name }));
    if (!staffList.length) throw new Error("No employees found. Add employees first.");

    const normalized = normalizePhone(payload.number);
    if (!normalized) throw new Error("Enter a valid phone number.");

    const existing = new Set(leads.map((l) => l.normalizedNumber || normalizePhone(l.number)));
    if (existing.has(normalized)) throw new Error("This phone number already exists.");

    let assignee: { email: string; name: string } | null = payload.specificEmployee || null;
    
    if (!assignee) {
      const counts = new Map<string, number>();
      for (const s of staffList) counts.set(s.email, countsByStaff.get(s.email) ?? 0);
      assignee = pickAssignee(staffList, counts);
    }
    
    if (!assignee) throw new Error("No employees found. Add employees first.");

    await addDoc(collection(db, "call_numbers"), {
      name: payload.name.trim(),
      number: normalized,
      normalizedNumber: normalized,
      location: payload.location?.trim() || "",
      details: payload.details?.trim() || "",
      source: payload.source?.trim() || "",
      assignedToEmail: assignee.email,
      assignedToName: assignee.name,
      assignedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }

  async function uploadLeads(rawLines: string[]) {
    const staffList = staffOptions.map((s) => ({ email: s.email, name: s.name }));
    if (!staffList.length) throw new Error("No employees found. Add employees first.");

    const existing = new Set(leads.map((l) => l.normalizedNumber || normalizePhone(l.number)));
    const counts = new Map<string, number>();
    for (const s of staffList) counts.set(s.email, countsByStaff.get(s.email) ?? 0);

    let added = 0;
    let skipped = 0;
    let invalid = 0;

    for (const line of rawLines) {
      const parsed = parseLeadLine(line);
      if (!parsed) continue;
      const normalized = normalizePhone(parsed.number);
      if (!normalized) {
        invalid += 1;
        continue;
      }
      if (existing.has(normalized)) {
        skipped += 1;
        continue;
      }
      const assignee = pickAssignee(staffList, counts);
      if (!assignee) throw new Error("No employees found. Add employees first.");

      await addDoc(collection(db, "call_numbers"), {
        name: parsed.name.trim(),
        number: normalized,
        normalizedNumber: normalized,
        source: parsed.source?.trim() || "",
        assignedToEmail: assignee.email,
        assignedToName: assignee.name,
        assignedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      existing.add(normalized);
      counts.set(assignee.email, (counts.get(assignee.email) ?? 0) + 1);
      added += 1;
    }

    setUploadResult({ added, skipped, invalid });
  }

  async function handleExcelUpload() {
    if (!excelFile) {
      setExcelError("Please select an Excel file");
      return;
    }

    if (uploadAssignmentMode === "specific" && uploadSelectedEmployees.length === 0) {
      setExcelError("Please select at least one employee for assignment");
      return;
    }
    
    setExcelUploading(true);
    setExcelError(null);
    setExcelResults({ success: 0, failed: 0, errors: [] });
    
    try {
      const data = await excelFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
      
      const staffList = staffOptions.map((s) => ({ email: s.email, name: s.name }));
      if (!staffList.length) {
        setExcelError("No employees found. Add employees first.");
        return;
      }
      
      const existing = new Set(leads.map((l) => l.normalizedNumber || normalizePhone(l.number)));
      const counts = new Map<string, number>();
      for (const s of staffList) counts.set(s.email, countsByStaff.get(s.email) ?? 0);

      // If specific employee mode, use selected employees for leads
      let specificAssignees: { email: string; name: string }[] = [];
      if (uploadAssignmentMode === "specific" && uploadSelectedEmployees.length > 0) {
        specificAssignees = staffList.filter(s => uploadSelectedEmployees.includes(s.email));
      }
      
      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];
      
      for (const row of jsonData) {
        try {
          // Handle various column name formats
          const clientName = row["Client Name"] || row["client name"] || row["ClientName"] || row["name"] || row["Name"] || "";
          const mobNo = row["Mob No"] || row["mob no"] || row["MobNo"] || row["number"] || row["Number"] || row["phone"] || row["Phone"] || "";
          const location = row["Location"] || row["location"] || "";
          const details = row["Deta"] || row["Details"] || row["details"] || row["Detail"] || row["detail"] || "";
          
          // Find source column by checking all keys for case-insensitive match, or use column E (5th column)
          const sourceKey = Object.keys(row).find(key => key.toLowerCase().includes("source"));
          const values = Object.values(row);
          let source = sourceKey ? String(row[sourceKey] || "").trim() : (values[4] ? String(values[4]).trim() : "");
          
          // Normalize source names
          if (source) {
            const sourceLower = source.toLowerCase();
            if (sourceLower.includes("99") || sourceLower.includes("99acres") || sourceLower.includes("99 acres")) {
              source = "99acres";
            } else if (sourceLower === "mb" || sourceLower === "magicbricks" || sourceLower === "magic bricks") {
              source = "MagicBricks";
            } else if (sourceLower === "olx") {
              source = "OLX";
            } else if (sourceLower.includes("housing") || sourceLower.includes("housing.com")) {
              source = "Housing.com";
            } else if (sourceLower.includes("commonfloor") || sourceLower.includes("common floor")) {
              source = "CommonFloor";
            } else if (sourceLower.includes("proptiger") || sourceLower.includes("prop tiger")) {
              source = "PropTiger";
            } else if (sourceLower.includes("facebook") || sourceLower.includes("fb")) {
              source = "Facebook";
            } else if (sourceLower.includes("instagram") || sourceLower.includes("insta")) {
              source = "Instagram";
            } else if (sourceLower.includes("whatsapp") || sourceLower.includes("wa")) {
              source = "WhatsApp";
            } else if (sourceLower.includes("google")) {
              source = "Google";
            } else if (sourceLower.includes("justdial")) {
              source = "Justdial";
            } else if (sourceLower.includes("sulekha")) {
              source = "Sulekha";
            } else if (sourceLower.includes("quikr")) {
              source = "Quikr";
            } else if (sourceLower.includes("direct") || sourceLower.includes("referral")) {
              source = "Direct/Referral";
            } else if (sourceLower.includes("website") || sourceLower.includes("web")) {
              source = "Website";
            } else if (sourceLower.includes("cold call") || sourceLower.includes("cold call")) {
              source = "Cold Call";
            } else if (sourceLower.includes("walk") || sourceLower.includes("walk-in")) {
              source = "Walk-in";
            } else if (sourceLower.includes("exhibition") || sourceLower.includes("expo")) {
              source = "Exhibition";
            } else if (sourceLower.includes("other")) {
              source = "Other";
            }
          }
          
          if (!clientName || !mobNo) {
            failedCount++;
            errors.push(`Missing Client Name or Mob No for row`);
            continue;
          }
          
          const normalized = normalizePhone(String(mobNo));
          if (!normalized) {
            failedCount++;
            errors.push(`Invalid phone number for ${clientName}`);
            continue;
          }
          
          if (existing.has(normalized)) {
            failedCount++;
            errors.push(`Duplicate phone number for ${clientName}`);
            continue;
          }
          
          // Pick assignee from specific employees or auto-assign
          let assignee: { email: string; name: string } | null = null;
          if (specificAssignees.length > 0) {
            assignee = pickAssignee(specificAssignees, counts);
          } else {
            assignee = pickAssignee(staffList, counts);
          }
          
          if (!assignee) {
            failedCount++;
            errors.push(`No assignee available for ${clientName}`);
            continue;
          }
          
          await addDoc(collection(db, "call_numbers"), {
            name: String(clientName).trim(),
            number: normalized,
            normalizedNumber: normalized,
            location: String(location).trim(),
            details: String(details).trim(),
            source: String(source).trim(),
            assignedToEmail: assignee.email,
            assignedToName: assignee.name,
            assignedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
          
          existing.add(normalized);
          counts.set(assignee.email, (counts.get(assignee.email) ?? 0) + 1);
          successCount++;
        } catch (err) {
          failedCount++;
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          errors.push(`Row error: ${errorMsg}`);
        }
      }
      
      setExcelResults({ success: successCount, failed: failedCount, errors });
      setExcelFile(null);
      setUploadSelectedEmployees([]);
      setUploadAssignmentMode("auto");
      
      if (successCount > 0) {
        setTimeout(() => {
          setOpenUpload(false);
          setExcelResults({ success: 0, failed: 0, errors: [] });
        }, 2000);
      }
    } catch (err) {
      setExcelError(err instanceof Error ? err.message : "Failed to process Excel file");
    } finally {
      setExcelUploading(false);
    }
  }

  const toggleLeadSelection = (id: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAllLeads = () => {
    const allIds = filtered.map(l => l.id);
    if (selectedLeads.size === allIds.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(allIds));
    }
  };

  const handleBulkDeleteLeads = async () => {
    try {
      for (const leadId of selectedLeads) {
        await updateDoc(doc(db, "call_numbers", leadId), {
          status: "deleted",
          deletedAt: serverTimestamp(),
        });
      }
      setSelectedLeads(new Set());
      setBulkDeleteConfirm(false);
    } catch (err) {
      console.error("Failed to delete leads:", err);
    }
  };

  const handleAllocateLeads = async () => {
    if (!selectedEmployeeForAllocation) {
      setError("Please select an employee to allocate leads to.");
      return;
    }

    const selectedEmployee = staffOptions.find(s => s.email === selectedEmployeeForAllocation);
    if (!selectedEmployee) {
      setError("Selected employee not found.");
      return;
    }

    try {
      for (const leadId of selectedLeads) {
        await updateDoc(doc(db, "call_numbers", leadId), {
          assignedToEmail: selectedEmployee.email,
          assignedToName: selectedEmployee.name,
          assignedAt: serverTimestamp(),
        });
      }
      setSelectedLeads(new Set());
      setSelectedEmployeeForAllocation("");
      setError(null);
    } catch (err) {
      console.error("Failed to allocate leads:", err);
      setError("Failed to allocate leads. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Leads</div>
          <div className="mt-1 text-sm text-slate-500">
            Upload leads and auto-assign equally across employees.
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0b1220] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-200"
            type="button"
            onClick={() => {
              setError(null);
              setOpenUpload(true);
            }}
          >
            <Upload size={16} /> Upload Leads
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200"
            type="button"
            onClick={() => {
              setError(null);
              setOpenAdd(true);
            }}
          >
            <UserPlus size={16} /> Add Lead
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-200 px-4 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-200"
            type="button"
            onClick={() => router.push("/recycle-bin")}
          >
            <Trash2 size={16} /> Recycle Bin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">Total Leads</div>
                <div className="mt-1 text-xs text-slate-500">
                  Collection: call_numbers
                </div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700">
                <Users size={18} />
              </div>
            </div>
            <div className="mt-5 text-3xl font-semibold text-slate-900">
              {loading ? "—" : totalLeads}
            </div>
            <div className="mt-5 flex items-center justify-between gap-6">
              <DonutChart segments={donutSegments} />
              <div className="min-w-0 flex-1 space-y-2">
                {topStaff.map((s) => (
                  <button
                    key={s.email}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setStaffEmailFilter((v) => (v === s.email ? "all" : s.email))}
                    title={s.fullLabel}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="shrink-0 text-slate-500">{s.value}</span>
                  </button>
                ))}
                {!loading && !topStaff.length ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    Add employees to enable auto-assignment.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold">Source Distribution</div>
                <div className="mt-1 text-xs text-slate-500">
                  Leads by source
                </div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-500/10 text-purple-700">
                <Upload size={18} />
              </div>
            </div>
            <div className="mt-5 text-3xl font-semibold text-slate-900">
              {loading ? "—" : sourceChartItems.reduce((sum, s) => sum + s.value, 0)}
            </div>
            <div className="mt-5 flex items-center justify-between gap-6">
              <DonutChart segments={sourceDonutSegments} />
              <div className="min-w-0 flex-1 space-y-2 max-h-48 overflow-auto">
                {sourceChartItems
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 8)
                  .map((s) => (
                    <button
                      key={s.source}
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                        sourceFilter === s.source
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-100 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      onClick={() => setSourceFilter((v) => (v === s.source ? "all" : s.source))}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="truncate">{s.source || "Unknown"}</span>
                      </span>
                      <span className="shrink-0 text-slate-500">{s.value}</span>
                    </button>
                  ))}
                {!loading && !sourceChartItems.length ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    No sources found.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Lead List</div>
              <div className="mt-1 text-xs text-slate-500">
                Search, filter by employee, and verify duplicates by phone number.
              </div>
            </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {selectedLeads.size > 0 && (
              <>
                <select
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={selectedEmployeeForAllocation}
                  onChange={(e) => setSelectedEmployeeForAllocation(e.target.value)}
                >
                  <option value="">Select Employee...</option>
                  {staffOptions.map((s) => (
                    <option key={s.email} value={s.email}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600"
                  type="button"
                  onClick={handleAllocateLeads}
                  disabled={!selectedEmployeeForAllocation}
                >
                  <Check size={16} /> Allocate ({selectedLeads.size})
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white shadow-sm shadow-rose-500/25 transition-colors hover:bg-rose-600"
                  type="button"
                  onClick={() => setBulkDeleteConfirm(true)}
                >
                  <Trash2 size={16} /> Delete Selected ({selectedLeads.size})
                </button>
              </>
            )}
              <select
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                value={staffEmailFilter}
                onChange={(e) => setStaffEmailFilter(e.target.value)}
              >
                <option value="all">All Employees</option>
                {staffOptions.map((s) => (
                  <option key={s.email} value={s.email}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:w-[280px]"
                placeholder="Search name / number / assigned..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 w-[50px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      checked={selectedLeads.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAllLeads}
                    />
                  </th>
                  <th className="w-[14%] px-6 py-3">Lead</th>
                  <th className="w-[14%] px-6 py-3">Number</th>
                  <th className="w-[12%] px-6 py-3">Location</th>
                  <th className="w-[12%] px-6 py-3">Source</th>
                  <th className="w-[18%] px-6 py-3">Assigned</th>
                  <th className="w-[10%] px-6 py-3">Assigned At</th>
                  <th className="w-[10%] px-6 py-3">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLeads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        checked={selectedLeads.has(l.id)}
                        onChange={() => toggleLeadSelection(l.id)}
                      />
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 break-words">
                      {l.name || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700 break-words">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-slate-900">
                          {l.number || l.normalizedNumber || "—"}
                        </div>
                        {l.number || l.normalizedNumber ? (
                          <div className="relative">
                            <button
                              type="button"
                              data-wa-button="true"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-white text-[#16a34a] shadow-sm transition-colors hover:border-[#16a34a] hover:bg-[#16a34a] hover:text-white focus:outline-none focus:ring-4 focus:ring-emerald-200"
                              aria-label="WhatsApp templates"
                              title="WhatsApp"
                              onClick={(e) => {
                                const target = e.currentTarget as HTMLButtonElement;
                                const rect = target.getBoundingClientRect();
                                const width = 280;
                                const padding = 12;
                                const x = Math.min(
                                  Math.max(padding, rect.left),
                                  window.innerWidth - width - padding,
                                );
                                const y = rect.bottom + 10;
                                setWaMenu((prev) =>
                                  prev?.lead.id === l.id ? null : { lead: l, x, y },
                                );
                              }}
                            >
                              <WhatsAppIcon size={16} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {l.normalizedNumber ? (
                        <div className="mt-0.5 text-xs font-semibold text-slate-500">
                          {l.normalizedNumber}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-slate-700 break-words">
                      {l.location || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700 break-words">
                      {normalizeSourceName(l.source) || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700 break-words">
                      <div className="font-semibold text-slate-900">
                        {l.assignedToName || "—"}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {l.assignedToEmail || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {l.assignedAt ? l.assignedAt.toLocaleString() : "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {l.createdAt ? l.createdAt.toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 ? (
                  <tr>
                    <td
                      className="px-6 py-8 text-center text-sm font-semibold text-slate-500"
                      colSpan={8}
                    >
                      No leads found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 ? (
            <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} records
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="text-xs font-semibold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {waMenu ? (
        <div
          ref={waMenuRef}
          className="fixed z-[80] w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
          style={{ left: waMenu.x, top: waMenu.y }}
        >
          <div className="px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              WhatsApp
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              Message Templates
            </div>
          </div>

          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                const link = whatsAppLink(
                  waMenu.lead.normalizedNumber || waMenu.lead.number,
                );
                window.open(link, "_blank", "noopener,noreferrer");
                setWaMenu(null);
              }}
            >
              Open Chat (No Message)
            </button>
          </div>

          <div className="border-t border-slate-100 p-2">
            {waTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const msg = renderTemplate(tpl.body, waMenu.lead);
                  const link = whatsAppLink(
                    waMenu.lead.normalizedNumber || waMenu.lead.number,
                    msg,
                  );
                  window.open(link, "_blank", "noopener,noreferrer");
                  setWaMenu(null);
                }}
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setWaMenu(null);
                setOpenWaTemplates(true);
              }}
            >
              Manage Templates
            </button>
          </div>
        </div>
      ) : null}

      {openWaTemplates ? (
        <div className="fixed inset-0 z-[90]">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOpenWaTemplates(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[560px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold">WhatsApp Templates</div>
                <div className="mt-1 text-xs text-slate-500">
                  Use {"{name}"} to insert lead name.
                </div>
              </div>
              <button
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                type="button"
                onClick={() => setOpenWaTemplates(false)}
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Template Name
                  </div>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    value={tplLabel}
                    maxLength={TEMPLATE_TITLE_MAX_CHARS}
                    onChange={(e) => setTplLabel(normalizeTitleInput(e.target.value))}
                    placeholder="e.g. Follow Up"
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
                    <div className="text-slate-500">
                      Max {TEMPLATE_TITLE_MAX_WORDS} words
                    </div>
                    <div
                      className={
                        tplLabel.length > TEMPLATE_TITLE_MAX_CHARS ||
                        titleWordCount(tplLabel) > TEMPLATE_TITLE_MAX_WORDS
                          ? "text-rose-600"
                          : "text-slate-500"
                      }
                    >
                      {tplLabel.length}/{TEMPLATE_TITLE_MAX_CHARS} •{" "}
                      {titleWordCount(tplLabel)}/{TEMPLATE_TITLE_MAX_WORDS}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Message
                  </div>
                  <textarea
                    className="mt-2 h-[140px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                    value={tplBody}
                    onChange={(e) => setTplBody(e.target.value)}
                    placeholder="Hi {name}, ..."
                  />
                  <div className="mt-2 text-[11px] font-semibold text-slate-500">
                    Variables: {"{name}"} • {"{phone}"}
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200"
                  onClick={() => {
                    const label = tplLabel.trim();
                    const body = tplBody.trim();
                    if (!label || !body) return;
                    if (
                      label.length > TEMPLATE_TITLE_MAX_CHARS ||
                      titleWordCount(label) > TEMPLATE_TITLE_MAX_WORDS
                    )
                      return;
                    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
                    setWaTemplates((prev) => [{ id, label, body }, ...prev]);
                    setTplLabel("");
                    setTplBody("");
                  }}
                >
                  Add Template
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <div className="bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Existing
                </div>
                <div className="divide-y divide-slate-100">
                  {waTemplates.map((t) => (
                    <div key={t.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {t.label}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">
                            {t.body}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          onClick={() =>
                            setWaTemplates((prev) => prev.filter((x) => x.id !== t.id))
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100"
                onClick={() => setWaTemplates(defaultWhatsAppTemplates)}
              >
                Reset to Default Templates
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openAdd ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (saving) return;
              setOpenAdd(false);
            }}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[520px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold">Add Lead</div>
                <div className="mt-1 text-xs text-slate-500">
                  Saves to Firestore collection call_numbers
                </div>
              </div>
              <button
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                type="button"
                onClick={() => {
                  if (saving) return;
                  setOpenAdd(false);
                }}
              >
                Close
              </button>
            </div>

            <form
              className="space-y-5 p-6"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setSaving(true);
                try {
                  let specificEmployee: { email: string; name: string } | undefined;
                  if (addLeadAssignmentMode === "specific" && addLeadSelectedEmployee) {
                    const employee = staffOptions.find(s => s.email === addLeadSelectedEmployee);
                    if (employee) {
                      specificEmployee = { email: employee.email, name: employee.name };
                    }
                  }
                  
                  await addOneLead({
                    name: leadName,
                    number: leadNumber,
                    location: leadLocation,
                    details: leadDetails,
                    source: leadSource,
                    specificEmployee
                  });
                  setLeadName("");
                  setLeadNumber("");
                  setLeadLocation("");
                  setLeadDetails("");
                  setLeadSource("");
                  setAddLeadSelectedEmployee("");
                  setAddLeadAssignmentMode("auto");
                  setOpenAdd(false);
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : "Failed to add lead";
                  setError(message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Assignment Mode
                </div>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      addLeadAssignmentMode === "auto"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => setAddLeadAssignmentMode("auto")}
                  >
                    Auto-assign
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      addLeadAssignmentMode === "specific"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => setAddLeadAssignmentMode("specific")}
                  >
                    Assign to Employee
                  </button>
                </div>
                {addLeadAssignmentMode === "specific" && (
                  <div className="mt-3">
                    <select
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                      value={addLeadSelectedEmployee}
                      onChange={(e) => setAddLeadSelectedEmployee(e.target.value)}
                    >
                      <option value="">Select Employee...</option>
                      {staffOptions.map((s) => (
                        <option key={s.email} value={s.email}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Lead name"
                />
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone Number
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={leadNumber}
                  onChange={(e) => setLeadNumber(e.target.value)}
                  placeholder="9876543210"
                  inputMode="tel"
                  required
                />
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location (optional)
                </div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={leadLocation}
                  onChange={(e) => setLeadLocation(e.target.value)}
                  placeholder="City, Area"
                />
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Details (optional)
                </div>
                <textarea
                  className="mt-2 h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={leadDetails}
                  onChange={(e) => setLeadDetails(e.target.value)}
                  placeholder="Additional information about the lead"
                />
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Source (optional)
                </div>
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                >
                  <option value="">Select source...</option>
                  <option value="99acres">99acres</option>
                  <option value="MagicBricks">MagicBricks</option>
                  <option value="OLX">OLX</option>
                  <option value="Housing.com">Housing.com</option>
                  <option value="CommonFloor">CommonFloor</option>
                  <option value="PropTiger">PropTiger</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Google">Google</option>
                  <option value="Justdial">Justdial</option>
                  <option value="Sulekha">Sulekha</option>
                  <option value="Quikr">Quikr</option>
                  <option value="Direct/Referral">Direct/Referral</option>
                  <option value="Website">Website</option>
                  <option value="Cold Call">Cold Call</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Exhibition">Exhibition</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (saving) return;
                    setOpenAdd(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {openUpload ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (excelUploading) return;
              setOpenUpload(false);
            }}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-[520px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <div className="text-sm font-semibold">Bulk Upload Leads</div>
                <div className="mt-1 text-xs text-slate-500">
                  Upload Excel file with columns: Client Name, Mob No, Location, Deta
                </div>
              </div>
              <button
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                type="button"
                onClick={() => {
                  if (excelUploading) return;
                  setOpenUpload(false);
                }}
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Assignment Mode
                </div>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      uploadAssignmentMode === "auto"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => setUploadAssignmentMode("auto")}
                  >
                    Auto-assign to All
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      uploadAssignmentMode === "specific"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => setUploadAssignmentMode("specific")}
                  >
                    Assign to Specific Employee
                  </button>
                </div>
                {uploadAssignmentMode === "specific" && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-auto">
                    {staffOptions.map((s) => (
                      <label
                        key={s.email}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          checked={uploadSelectedEmployees.includes(s.email)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUploadSelectedEmployees([...uploadSelectedEmployees, s.email]);
                            } else {
                              setUploadSelectedEmployees(uploadSelectedEmployees.filter(email => email !== s.email));
                            }
                          }}
                        />
                        <span className="text-sm font-semibold text-slate-700">{s.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Excel File
                </div>
                <div className="mt-2">
                  <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet size={32} className="text-slate-400" />
                      <span className="text-sm font-semibold text-slate-600">
                        {excelFile ? excelFile.name : "Click to upload Excel file"}
                      </span>
                      <span className="text-xs text-slate-500">
                        .xlsx, .xls files only
                      </span>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setExcelFile(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Expected Format
                </div>
                <div className="text-xs text-slate-700 space-y-1">
                  <p>Excel file should have these columns:</p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li><strong>Client Name</strong>: Lead name</li>
                    <li><strong>Mob No</strong>: Phone number</li>
                    <li><strong>Location</strong>: Location (optional)</li>
                    <li><strong>Deta</strong>: Details (optional)</li>
                    <li><strong>Source</strong>: Source (optional, e.g., 99acres, MagicBricks)</li>
                  </ul>
                </div>
              </div>

              {excelError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {excelError}
                </div>
              ) : null}

              {excelResults.success > 0 || excelResults.failed > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                    Upload Results
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">Success:</span>
                      <span className="font-semibold text-emerald-600">{excelResults.success}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">Failed:</span>
                      <span className="font-semibold text-rose-600">{excelResults.failed}</span>
                    </div>
                    {excelResults.errors.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-slate-500 mb-1">Errors:</div>
                        <div className="max-h-32 overflow-auto rounded-lg bg-white p-2 text-xs text-slate-700">
                          {excelResults.errors.map((error, idx) => (
                            <div key={idx} className="py-1">• {error}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  disabled={excelUploading}
                  onClick={() => {
                    if (excelUploading) return;
                    setOpenUpload(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  disabled={excelUploading || !excelFile}
                  onClick={handleExcelUpload}
                >
                  {excelUploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {bulkDeleteConfirm ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setBulkDeleteConfirm(false)}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/10 text-rose-600">
                  <Trash2 size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold">Bulk Delete Leads</div>
                  <div className="mt-1 text-xs text-slate-500">
                    This action cannot be undone.
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-700 mb-6">
                Are you sure you want to delete {selectedLeads.size} lead{selectedLeads.size > 1 ? 's' : ''}? This will remove them from the system.
              </p>
              <div className="flex gap-3">
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={() => setBulkDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-rose-500 px-4 text-sm font-semibold text-white shadow-sm shadow-rose-500/25 transition-colors hover:bg-rose-600"
                  type="button"
                  onClick={handleBulkDeleteLeads}
                >
                  Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
