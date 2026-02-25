"use client";

import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { statsApi, UserData } from "@/modules/analytics/services/stats";
import { Card } from "@/modules/shared/ui/Card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface PaginationData {
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "joined_desc" | "joined_asc" | "name_asc"
  >("joined_desc");
  const PAGE_SIZE = 15;

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await statsApi.getAllUsers({
        page: currentPage,
        limit: PAGE_SIZE,
      });
      if (response.success && response.data) {
        setUsers(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
        return;
      }

      setError(response.message || "Failed to load users.");
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (loading) {
    return <div className="text-center py-12">Loading users...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          badge="Admin"
          title="All Users"
          subtitle="View and manage all registered users on the platform."
        />
        <Card className="bg-white">
          <div className="py-10 text-center space-y-3">
            <p className="text-red-600 font-semibold">{error}</p>
            <button
              onClick={fetchUsers}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const visibleUsers = [...users]
    .filter((user) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      );
    })
    .sort((left, right) => {
      if (sortBy === "name_asc") {
        return left.name.localeCompare(right.name);
      }
      if (sortBy === "joined_asc") {
        return (
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()
        );
      }
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        badge="Admin"
        title="All Users"
        subtitle="View and manage all registered users on the platform."
      />

      <Card className="bg-white">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or email"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(
                event.target.value as "joined_desc" | "joined_asc" | "name_asc",
              )
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="joined_desc">Newest joined first</option>
            <option value="joined_asc">Oldest joined first</option>
            <option value="name_asc">Name (A-Z)</option>
          </select>
        </div>
      </Card>

      <Card className="p-0 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full">
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
                  Joined Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-600"
                  >
                    {searchQuery
                      ? "No users match your search"
                      : "No users found"}
                  </td>
                </tr>
              ) : (
                visibleUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-900 font-medium">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-power-orange/10 text-power-orange text-xs rounded-full font-medium">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-power-orange hover:text-orange-600 transition-colors text-sm font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 p-4 bg-white rounded-lg border border-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600 text-center sm:text-left">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, pagination.total)} of{" "}
            {pagination.total} users
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={18} />
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .slice(
                Math.max(0, currentPage - 2),
                Math.min(pagination.totalPages, currentPage + 1),
              )
              .map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
                    currentPage === page
                      ? "bg-power-orange text-white"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              ))}

            <button
              onClick={() =>
                setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))
              }
              disabled={currentPage === pagination.totalPages}
              className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
