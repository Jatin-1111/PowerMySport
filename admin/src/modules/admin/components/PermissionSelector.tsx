"use client";

import React, { useState } from "react";
import { RoleTemplate } from "@/types";
import { Info } from "lucide-react";

// Permission module structure for display
const PERMISSION_MODULES = {
  users: { name: "User Management", icon: "👥" },
  venues: { name: "Venue Management", icon: "🏟️" },
  bookings: { name: "Booking Management", icon: "📅" },
  coaches: { name: "Coach Management", icon: "🏋️" },
  disputes: { name: "Dispute & Refund Management", icon: "⚖️" },
  analytics: { name: "Analytics & Reports", icon: "📊" },
  admins: { name: "Admin Management", icon: "👔" },
  settings: { name: "System Settings", icon: "⚙️" },
  reviews: { name: "Review Management", icon: "⭐" },
};

// Permission labels for display
const PERMISSION_LABELS: Record<string, string> = {
  "users:view": "View Users",
  "users:manage": "Manage Users",
  "users:delete": "Delete Users",
  "venues:view": "View Venues",
  "venues:manage": "Manage Venues",
  "venues:delete": "Delete Venues",
  "venues:approve": "Approve Venues",
  "bookings:view": "View Bookings",
  "bookings:manage": "Manage Bookings",
  "bookings:cancel": "Cancel Bookings",
  "bookings:refund": "Process Refunds",
  "coaches:view": "View Coaches",
  "coaches:manage": "Manage Coaches",
  "coaches:verify": "Verify Coaches",
  "coaches:delete": "Delete Coaches",
  "disputes:view": "View Disputes",
  "disputes:manage": "Manage Disputes",
  "disputes:resolve": "Resolve Disputes",
  "analytics:view": "View Analytics",
  "analytics:export": "Export Reports",
  "admins:view": "View Admins",
  "admins:manage": "Manage Admins",
  "admins:delete": "Delete Admins",
  "settings:view": "View Settings",
  "settings:manage": "Manage Settings",
  "reviews:view": "View Reviews",
  "reviews:manage": "Manage Reviews",
  "reviews:delete": "Delete Reviews",
};

interface PermissionSelectorProps {
  roleTemplates: RoleTemplate[];
  selectedRole: string;
  selectedPermissions: string[];
  onRoleChange: (role: string) => void;
  onPermissionsChange: (permissions: string[]) => void;
  disabled?: boolean;
}

export default function PermissionSelector({
  roleTemplates,
  selectedRole,
  selectedPermissions,
  onRoleChange,
  onPermissionsChange,
  disabled = false,
}: PermissionSelectorProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(),
  );
  const [customMode, setCustomMode] = useState(false);
  const [showPermissionInfo, setShowPermissionInfo] = useState(false);

  // Group permissions by module
  const groupedPermissions: Record<string, string[]> = {};
  Object.keys(PERMISSION_MODULES).forEach((module) => {
    groupedPermissions[module] = Object.keys(PERMISSION_LABELS).filter((perm) =>
      perm.startsWith(`${module}:`),
    );
  });

  // Handle role template selection
  const handleRoleChange = (role: string) => {
    onRoleChange(role);
    const template = roleTemplates.find((t) => t.role === role);
    if (template) {
      onPermissionsChange([...template.permissions]);
      setCustomMode(false);
    }
  };

  // Handle individual permission toggle
  const handlePermissionToggle = (permission: string) => {
    if (disabled) return;

    setCustomMode(true);
    const newPermissions = selectedPermissions.includes(permission)
      ? selectedPermissions.filter((p) => p !== permission)
      : [...selectedPermissions, permission];
    onPermissionsChange(newPermissions);
  };

  // Toggle module expansion
  const toggleModule = (module: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(module)) {
      newExpanded.delete(module);
    } else {
      newExpanded.add(module);
    }
    setExpandedModules(newExpanded);
  };

  // Check if all permissions in a module are selected
  const isModuleFullySelected = (module: string) => {
    const modulePerms = groupedPermissions[module] || [];
    return modulePerms.every((perm) => selectedPermissions.includes(perm));
  };

  // Check if some permissions in a module are selected
  const isModulePartiallySelected = (module: string) => {
    const modulePerms = groupedPermissions[module] || [];
    return (
      modulePerms.some((perm) => selectedPermissions.includes(perm)) &&
      !isModuleFullySelected(module)
    );
  };

  // Toggle all permissions in a module
  const toggleModulePermissions = (module: string) => {
    if (disabled) return;

    setCustomMode(true);
    const modulePerms = groupedPermissions[module] || [];
    const allSelected = isModuleFullySelected(module);

    let newPermissions: string[];
    if (allSelected) {
      // Deselect all module permissions
      newPermissions = selectedPermissions.filter(
        (p) => !modulePerms.includes(p),
      );
    } else {
      // Select all module permissions
      newPermissions = [...new Set([...selectedPermissions, ...modulePerms])];
    }
    onPermissionsChange(newPermissions);
  };

  return (
    <div className="space-y-6">
      {/* Role Template Selector */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Role Template
          </label>
          {selectedRole && (
            <div className="relative">
              <button
                type="button"
                onMouseEnter={() => setShowPermissionInfo(true)}
                onMouseLeave={() => setShowPermissionInfo(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
              {showPermissionInfo && (
                <div className="absolute left-6 top-0 z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900 mb-2">
                      {roleTemplates.find((t) => t.role === selectedRole)?.name}{" "}
                      Permissions:
                    </p>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {roleTemplates
                        .find((t) => t.role === selectedRole)
                        ?.permissions.map((perm) => (
                          <div
                            key={perm}
                            className="text-xs text-gray-600 flex items-start gap-1"
                          >
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>{PERMISSION_LABELS[perm] || perm}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <select
          value={selectedRole}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">Select a role template...</option>
          {roleTemplates.map((template) => (
            <option key={template.role} value={template.role}>
              {template.name}
            </option>
          ))}
        </select>
        {selectedRole && (
          <p className="mt-2 text-sm text-gray-600">
            {roleTemplates.find((t) => t.role === selectedRole)?.description}
          </p>
        )}
        {customMode && (
          <p className="mt-2 text-sm text-amber-600 font-medium">
            ⚠️ Custom permissions (modified from template)
          </p>
        )}
      </div>

      {/* Permission Checkboxes */}
      {selectedRole && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Permissions ({selectedPermissions.length} selected)
            </label>
            <button
              type="button"
              onClick={() =>
                expandedModules.size === 0
                  ? setExpandedModules(new Set(Object.keys(PERMISSION_MODULES)))
                  : setExpandedModules(new Set())
              }
              className="text-sm text-green-600 hover:text-green-700"
            >
              {expandedModules.size === 0 ? "Expand All" : "Collapse All"}
            </button>
          </div>

          <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
            {Object.entries(PERMISSION_MODULES).map(([moduleKey, module]) => {
              const isExpanded = expandedModules.has(moduleKey);
              const isFullySelected = isModuleFullySelected(moduleKey);
              const isPartiallySelected = isModulePartiallySelected(moduleKey);
              const modulePerms = groupedPermissions[moduleKey] || [];

              return (
                <div key={moduleKey}>
                  {/* Module Header */}
                  <div className="flex items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={isFullySelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = isPartiallySelected;
                        }
                      }}
                      onChange={() => toggleModulePermissions(moduleKey)}
                      disabled={disabled}
                      className="h-5 w-5 text-green-600 rounded border-gray-300 focus:ring-green-500 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => toggleModule(moduleKey)}
                      className="flex-1 flex items-center justify-between ml-3 text-left"
                    >
                      <span className="font-medium text-gray-900">
                        {module.icon} {module.name}
                      </span>
                      <svg
                        className={`h-5 w-5 text-gray-500 transition-transform ${
                          isExpanded ? "transform rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Module Permissions */}
                  {isExpanded && (
                    <div className="p-4 space-y-2 bg-white">
                      {modulePerms.map((permission) => (
                        <label
                          key={permission}
                          className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(permission)}
                            onChange={() => handlePermissionToggle(permission)}
                            disabled={disabled}
                            className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500 disabled:cursor-not-allowed"
                          />
                          <span className="text-sm text-gray-700">
                            {PERMISSION_LABELS[permission] || permission}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
