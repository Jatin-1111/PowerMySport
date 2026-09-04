"use client";

import { useAuthStore } from "@/modules/auth/store/authStore";
import { Edit2, UserSquare } from "lucide-react";
import Link from "next/link";

export function ContactView() {
  const { user } = useAuthStore();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900">Contact Details</h2>
        <Link
          href="/dashboard/my-profile"
          className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 hover:text-slate-900"
        >
          <Edit2 className="h-4 w-4" /> Edit Profile
        </Link>
      </div>

      <div className="max-w-2xl space-y-8">
        <div className="flex items-center gap-6 border-b border-slate-100 pb-8">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-lg">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <UserSquare className="h-10 w-10 text-slate-400" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{user.name}</h3>
            <p className="text-sm text-slate-500">Member since 2024</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Full Name</p>
            <p className="mt-1 font-semibold text-slate-900">{user.name}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Email Address
            </p>
            <p className="mt-1 font-semibold text-slate-900">{user.email}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Phone Number
            </p>
            <p className="mt-1 font-semibold text-slate-900">{user.phone || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Preferred Sport
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {user.playerProfile?.sportsFocus?.join(", ") || "None specified"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
