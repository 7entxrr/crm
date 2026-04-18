import { NextRequest, NextResponse } from "next/server";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface LeadData {
  name: string;
  number: string;
  email?: string;
  source: string;
}

interface UploadRequest {
  leads: LeadData[];
}

export async function POST(request: NextRequest) {
  try {
    const body: UploadRequest = await request.json();
    const { leads } = body;

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json(
        { message: "Invalid request format. Leads array is required." },
        { status: 400 }
      );
    }

    // Validate each lead
    for (const lead of leads) {
      if (!lead.name || !lead.number || !lead.source) {
        return NextResponse.json(
          { message: "Each lead must have name, number, and source." },
          { status: 400 }
        );
      }

      if (lead.number.length < 10) {
        return NextResponse.json(
          { message: "Phone number must be at least 10 digits." },
          { status: 400 }
        );
      }
    }

    // Normalize phone numbers
    const normalizedLeads = leads.map(lead => ({
      name: lead.name.trim(),
      number: lead.number.trim(),
      normalizedNumber: lead.number.replace(/\D/g, ''), // Remove non-digits
      email: lead.email?.trim() || "",
      source: lead.source.trim(),
      status: "new",
      createdAt: serverTimestamp(),
      assignedToEmail: "",
      assignedToName: ""
    }));

    // Add leads to Firestore
    const callNumbersCollection = collection(db, "call_numbers");
    const uploadPromises = normalizedLeads.map(lead => 
      addDoc(callNumbersCollection, lead)
    );

    await Promise.all(uploadPromises);

    return NextResponse.json(
      { 
        message: `Successfully uploaded ${leads.length} leads`,
        count: leads.length
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error uploading leads:", error);
    return NextResponse.json(
      { message: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}
