"use client";

import React, { useEffect, useState } from "react";
import { User } from "@/types";
import { authApi } from "@/lib/auth";

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
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>

      <div className="bg-white rounded-lg p-6 shadow max-w-md">
        <div className="mb-4">
          <label className="block text-gray-600 text-sm font-semibold">
            Name
          </label>
          <p className="text-gray-900">{user.name}</p>
        </div>

        <div className="mb-4">
          <label className="block text-gray-600 text-sm font-semibold">
            Email
          </label>
          <p className="text-gray-900">{user.email}</p>
        </div>

        <div className="mb-4">
          <label className="block text-gray-600 text-sm font-semibold">
            Phone
          </label>
          <p className="text-gray-900">{user.phone}</p>
        </div>

        <div className="mb-4">
          <label className="block text-gray-600 text-sm font-semibold">
            Account Type
          </label>
          <p className="text-gray-900 capitalize">{user.role}</p>
        </div>
      </div>
    </div>
  );
}
