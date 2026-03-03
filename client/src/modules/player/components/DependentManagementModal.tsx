"use client";

import { toast } from "@/lib/toast";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface Dependent {
  _id?: string;
  name: string;
  dob: string | Date;
  gender?: "MALE" | "FEMALE" | "OTHER";
  relation?: string;
  sports?: string[];
}

interface DependentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Dependent) => Promise<void>;
  initialDependent?: Dependent | null;
  isLoading?: boolean;
  mode: "add" | "edit";
}

export default function DependentManagementModal({
  isOpen,
  onClose,
  onSubmit,
  initialDependent,
  isLoading = false,
  mode,
}: DependentManagementModalProps) {
  const [formData, setFormData] = useState<Dependent>(
    initialDependent || {
      name: "",
      dob: "",
      gender: "MALE",
      relation: "CHILD",
      sports: [],
    },
  );

  // Update form data when modal opens or initialDependent changes
  useEffect(() => {
    if (isOpen) {
      if (initialDependent) {
        // Convert date to YYYY-MM-DD format for input field
        const dobValue = initialDependent.dob
          ? new Date(initialDependent.dob).toISOString().split("T")[0]
          : "";

        setFormData({
          ...initialDependent,
          dob: dobValue,
        });
      } else {
        // Reset form for add mode
        setFormData({
          name: "",
          dob: "",
          gender: "MALE",
          relation: "CHILD",
          sports: [],
        });
      }
    }
  }, [isOpen, initialDependent]);

  const handleChange = (field: keyof Dependent, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!formData.dob) {
      toast.error("Date of birth is required");
      return;
    }

    try {
      await onSubmit(formData);
      setFormData({
        name: "",
        dob: "",
        gender: "MALE",
        relation: "CHILD",
        sports: [],
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save dependent");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-900">
            {mode === "add" ? "Add Dependent" : "Edit Dependent"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g., John Doe"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date of Birth *
            </label>
            <input
              type="date"
              value={formData.dob as string}
              onChange={(e) => handleChange("dob", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Gender
              </label>
              <select
                value={formData.gender || "MALE"}
                onChange={(e) => handleChange("gender", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Relation
              </label>
              <input
                type="text"
                value={formData.relation || ""}
                onChange={(e) => handleChange("relation", e.target.value)}
                placeholder="e.g., Son, Daughter"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Sports
            </label>
            <SportsMultiSelect
              value={formData.sports || []}
              onChange={(sports) => handleChange("sports", sports)}
            />
          </div>

          <div className="flex flex-col justify-end gap-3 border-t border-slate-200 pt-4 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full sm:min-w-25 sm:w-auto"
            >
              {isLoading
                ? "Saving..."
                : mode === "add"
                  ? "Add Dependent"
                  : "Update"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
