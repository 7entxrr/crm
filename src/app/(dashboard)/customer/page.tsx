"use client";

import { useState, useEffect } from "react";
import { Card } from "../_components/ui";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  createdAt: Date | null;
};

export default function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading customer data
    setTimeout(() => {
      setCustomers([]);
      setIsLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600">Manage your customer database</p>
        </div>

        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          </div>
        ) : (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-500">No customers found</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
