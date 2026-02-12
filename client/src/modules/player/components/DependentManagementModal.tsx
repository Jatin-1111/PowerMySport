"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
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
  const [sportInput, setSportInput] = useState("");
  const [error, setError] = useState("");

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
      setError("");
      setSportInput("");
    }
  }, [isOpen, initialDependent]);

  const handleChange = (field: keyof Dependent, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError("");
  };

  const addSport = () => {
    if (sportInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        sports: [...(prev.sports || []), sportInput.trim()],
      }));
      setSportInput("");
    }
  };

  const removeSport = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sports: prev.sports?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (!formData.dob) {
      setError("Date of birth is required");
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
      setSportInput("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save dependent");
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
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Sports
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={sportInput}
                onChange={(e) => setSportInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSport();
                  }
                }}
                placeholder="e.g., Cricket"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-power-orange/50 text-sm"
              />
              <Button
                type="button"
                onClick={addSport}
                variant="secondary"
                className="whitespace-nowrap"
              >
                Add
              </Button>
            </div>

            {(formData.sports || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(formData.sports || []).map((sport, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 bg-power-orange/10 border border-power-orange/30 text-power-orange px-3 py-1 rounded-full text-sm"
                  >
                    {sport}
                    <button
                      type="button"
                      onClick={() => removeSport(index)}
                      className="hover:text-power-orange font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="min-w-[100px]"
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
