"use client";

import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { ProfileEditField } from "@/modules/player/components/ProfileEditField";
import { ProfileEditPanel } from "@/modules/player/components/ProfileEditPanel";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/modules/shared/ui/Input";
import { Modal } from "@/modules/shared/ui/Modal";
import { GraduationCap, Mail, Phone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const axiosError = error as { response?: { data?: { message?: string } } };
    return axiosError.response?.data?.message || "An error occurred";
  }
  if (error instanceof Error) return error.message;
  return "An error occurred";
};

interface DependentManageSectionProps {
  dependentId: string;
  name: string;
  age: number | null;
  /** Called after a graduation so the page reloads the profile. */
  onGraduated: () => Promise<void>;
}

/**
 * The two actions that change what this profile is: graduating a child to their own account and
 * deleting the profile. They are kept at the very end, quiet, because a parent rarely wants them
 * and should not meet them while looking for something else.
 */
export function DependentManageSection({
  dependentId,
  name,
  age,
  onGraduated,
}: DependentManageSectionProps) {
  const router = useRouter();
  const isEligibleToGraduate = age !== null && age >= 18;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showGraduationModal, setShowGraduationModal] = useState(false);
  const [isGraduating, setIsGraduating] = useState(false);
  const [graduationForm, setGraduationForm] = useState({ email: "", password: "", phone: "" });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await authApi.deleteDependent(dependentId);
      toast.success("Dependent deleted");
      router.push("/dashboard/my-profile");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Failed to delete dependent");
    } finally {
      setIsDeleting(false);
    }
  };

  const closeGraduationModal = () => {
    setShowGraduationModal(false);
    setGraduationForm({ email: "", password: "", phone: "" });
  };

  const handleGraduate = async () => {
    if (!graduationForm.email || !graduationForm.password || !graduationForm.phone) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsGraduating(true);
    try {
      const response = await authApi.graduateDependent({
        dependentId,
        email: graduationForm.email,
        password: graduationForm.password,
        phone: graduationForm.phone,
      });
      if (response.success) {
        toast.success("Dependent graduated to an independent account.");
        closeGraduationModal();
        await onGraduated();
      } else {
        toast.error(response.message || "Failed to graduate dependent");
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Failed to graduate dependent");
    } finally {
      setIsGraduating(false);
    }
  };

  const setField = (field: keyof typeof graduationForm) => (value: string) =>
    setGraduationForm((prev) => ({ ...prev, [field]: value }));

  return (
    <section
      aria-labelledby="manage-heading"
      id="manage"
      className="border-hairline scroll-mt-24 border-t pt-10"
    >
      <h2
        id="manage-heading"
        className="font-editorial text-ink text-2xl font-light tracking-tight sm:text-3xl"
      >
        Manage this profile
      </h2>
      <ul className="divide-hairline border-hairline mt-6 divide-y border-y">
        <li className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-ink font-medium">Give {name} their own account</h3>
            <p className="text-ink-body mt-1 max-w-xl text-pretty text-sm">
              {isEligibleToGraduate
                ? `${name} can sign in and book independently.`
                : `Available once ${name} turns 18 (now ${age ?? "?"}).`}
            </p>
          </div>
          <Button
            onClick={() => setShowGraduationModal(true)}
            disabled={!isEligibleToGraduate}
            variant={isEligibleToGraduate ? "primary" : "outline"}
            icon={<GraduationCap size={16} strokeWidth={1.5} />}
            className="min-h-11 w-full sm:w-auto"
          >
            Graduate
          </Button>
        </li>
        <li className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-ink font-medium">Delete this profile</h3>
            <p className="text-ink-body mt-1 max-w-xl text-pretty text-sm">
              Permanently removes {name}&apos;s profile, assessment results and saved plans. A child
              with an open booking or session cannot be deleted until it is finished or cancelled.
              This cannot be undone.
            </p>
          </div>
          <Button
            onClick={() => setShowDeleteModal(true)}
            variant="ghost"
            size="sm"
            className="min-h-11 text-red-700 hover:bg-red-50 hover:text-red-800"
            icon={<Trash2 size={14} strokeWidth={1.5} />}
          >
            Delete
          </Button>
        </li>
      </ul>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete dependent"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              loading={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-ink-body text-sm">
          Are you sure you want to delete
          <span className="text-ink font-semibold"> {name}</span>? This action cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={showGraduationModal}
        onClose={closeGraduationModal}
        title="Graduate to independent account"
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeGraduationModal}
              disabled={isGraduating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleGraduate}
              loading={isGraduating}
              disabled={!graduationForm.email || !graduationForm.password || !graduationForm.phone}
            >
              Graduate
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <ProfileEditPanel
            title={`Account for ${name}`}
            description="They will use these credentials to sign in and book independently."
          >
            <div className="space-y-4">
              <ProfileEditField
                label="Email"
                htmlFor="graduation-email"
                required
                icon={Mail}
                hint="This becomes their login email."
              >
                <Input
                  id="graduation-email"
                  type="email"
                  value={graduationForm.email}
                  onChange={(event) => setField("email")(event.target.value)}
                  placeholder="newaccount@example.com"
                />
              </ProfileEditField>

              <ProfileEditField
                label="Password"
                htmlFor="graduation-password"
                required
                hint="Minimum 8 characters recommended."
              >
                <Input
                  id="graduation-password"
                  type="password"
                  value={graduationForm.password}
                  onChange={(event) => setField("password")(event.target.value)}
                  placeholder="Create a password"
                />
              </ProfileEditField>

              <ProfileEditField
                label="Phone"
                htmlFor="graduation-phone"
                required
                icon={Phone}
                hint="Used for booking confirmations."
              >
                <Input
                  id="graduation-phone"
                  type="tel"
                  value={graduationForm.phone}
                  onChange={(event) => setField("phone")(event.target.value)}
                  placeholder="Phone number"
                />
              </ProfileEditField>
            </div>
          </ProfileEditPanel>
        </div>
      </Modal>
    </section>
  );
}
