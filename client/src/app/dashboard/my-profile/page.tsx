"use client";

import { Card } from "@/components/ui/Card";
import { authApi } from "@/lib/auth";
import { User } from "@/types";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await authApi.getProfile();
        if (response.success && response.data) {
          setUser(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (isLoading) {
    return <div className="text-center py-12">Loading profile...</div>;
  }

  if (!user) {
    return <div className="text-center py-12">Failed to load profile</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-slate-900">My Profile</h1>

      <Card className="max-w-md bg-white">
        <div className="space-y-4">
          <div>
            <label className="block text-slate-600 text-sm font-semibold mb-1">
              Name
            </label>
            <p className="text-slate-900 text-lg">{user.name}</p>
          </div>

          <div>
            <label className="block text-slate-600 text-sm font-semibold mb-1">
              Email
            </label>
            <p className="text-slate-900 text-lg">{user.email}</p>
          </div>

          <div>
            <label className="block text-slate-600 text-sm font-semibold mb-1">
              Phone
            </label>
            <p className="text-slate-900 text-lg">{user.phone}</p>
          </div>

          <div>
            <label className="block text-slate-600 text-sm font-semibold mb-1">
              Account Type
            </label>
            <p className="text-slate-900 text-lg capitalize">{user.role}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
