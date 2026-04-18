"use client";

import { useState } from "react";
import { Upload, Plus, X, ChevronDown } from "lucide-react";

interface LeadData {
  name: string;
  number: string;
  email?: string;
  source: string;
}

const LEAD_SOURCES = [
  "99acres",
  "MagicBricks",
  "OLX",
  "Facebook",
  "Instagram",
  "Google",
  "Website",
  "Referral",
  "Call",
  "WhatsApp",
  "Email",
  "Housing.com",
  "Quikr",
  "Square Yards",
  "Just Lead",
  "Other"
];

export default function UploadLeadsPage() {
  const [leads, setLeads] = useState<LeadData[]>([{ name: "", number: "", email: "", source: "99acres" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const addNewLead = () => {
    setLeads([...leads, { name: "", number: "", email: "", source: "99acres" }]);
  };

  const removeLead = (index: number) => {
    const newLeads = leads.filter((_, i) => i !== index);
    setLeads(newLeads.length > 0 ? newLeads : [{ name: "", number: "", email: "", source: "99acres" }]);
  };

  const updateLead = (index: number, field: keyof LeadData, value: string) => {
    const newLeads = [...leads];
    newLeads[index] = { ...newLeads[index], [field]: value };
    setLeads(newLeads);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/leads/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ leads }),
      });

      if (response.ok) {
        setSuccessMessage(`Successfully uploaded ${leads.length} leads!`);
        setLeads([{ name: "", number: "", email: "", source: "99acres" }]);
      } else {
        const error = await response.json();
        setErrorMessage(error.message || "Failed to upload leads");
      }
    } catch (error) {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const lines = text.split('\n').filter(line => line.trim());
    
    const bulkLeads: LeadData[] = lines.map(line => {
      const parts = line.split(',').map(part => part.trim());
      return {
        name: parts[0] || "",
        number: parts[1] || "",
        email: parts[2] || "",
        source: parts[3] || "Other"
      };
    });

    setLeads(bulkLeads.length > 0 ? bulkLeads : [{ name: "", number: "", email: "", source: "99acres" }]);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Upload Leads</h1>
          <p className="text-gray-600">Add new leads with source tracking</p>
        </div>

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{errorMessage}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Add Leads Manually</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4 mb-6">
              {leads.map((lead, index) => (
                <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                      type="text"
                      placeholder="Name"
                      value={lead.name}
                      onChange={(e) => updateLead(index, "name", e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={lead.number}
                      onChange={(e) => updateLead(index, "number", e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email (optional)"
                      value={lead.email}
                      onChange={(e) => updateLead(index, "email", e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="relative">
                      <select
                        value={lead.source}
                        onChange={(e) => updateLead(index, "source", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                        required
                      >
                        {LEAD_SOURCES.map(source => (
                          <option key={source} value={source}>{source}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  {leads.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLead(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-4 mb-6">
              <button
                type="button"
                onClick={addNewLead}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Another Lead</span>
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span>{isSubmitting ? "Uploading..." : "Upload Leads"}</span>
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Bulk Upload</h2>
            <p className="text-sm text-gray-600 mt-1">Upload multiple leads at once (format: name,phone,email,source)</p>
          </div>
          
          <div className="p-6">
            <textarea
              placeholder="John Doe,9876543210,john@example.com,99acres&#10;Jane Smith,9876543211,jane@example.com,MagicBricks&#10;Bob Johnson,9876543212,bob@example.com,OLX"
              onChange={handleBulkUpload}
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <div className="mt-4 text-sm text-gray-600">
              <p>Format: Name, Phone, Email, Source (one per line)</p>
              <p>Available sources: {LEAD_SOURCES.join(", ")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
