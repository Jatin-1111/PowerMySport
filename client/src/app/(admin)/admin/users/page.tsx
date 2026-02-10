"use client";

import { Card } from "@/modules/shared/ui/Card";
import { statsApi, UserData } from "@/modules/analytics/services/stats";
import { useEffect, useState } from "react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await statsApi.getAllUsers();
        if (response.success && response.data) {
          setUsers(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading users...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-slate-900">All Users</h1>

      <Card className="p-0 bg-white overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Name
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Email
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Role
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-slate-900">{user.name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-slate-900">{user.email}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-power-orange/10 text-power-orange text-xs rounded-full">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-power-orange hover:text-orange-600 transition-colors text-sm">
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

