"use client";

import React, { useState } from "react";
import { PermissionModule, RoleTemplate } from "@/types";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  Database,
  Gauge,
  GraduationCap,
  Bell,
  Info,
  KeyRound,
  type LucideIcon,
  Package,
  Route,
  ShoppingBag,
  ShieldAlert,
  Star,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";

// Icons are presentation only; the modules, their names and permission labels
// come from the server's permission catalog. A module the server adds later
// renders with the fallback icon instead of disappearing.
const MODULE_ICONS: Record<string, LucideIcon> = {
  users: Users,
  venues: Warehouse,
  bookings: Calendar,
  coaches: Briefcase,
  academies: BookOpen,
  inquiries: ShieldAlert,
  disputes: ShieldAlert,
  analytics: BarChart3,
  admins: UserCog,
  reviews: Star,
  products: Package,
  orders: ShoppingBag,
  pathways: Route,
  opportunities: GraduationCap,
  dataSources: Database,
  notifications: Bell,
};

interface PermissionSelectorProps {
  roleTemplates: RoleTemplate[];
  permissionCatalog: PermissionModule[];
  selectedRole: string;
  selectedPermissions: string[];
  onRoleChange: (role: string) => void;
  onPermissionsChange: (permissions: string[]) => void;
  disabled?: boolean;
}

export default function PermissionSelector({
  roleTemplates,
  permissionCatalog,
  selectedRole,
  selectedPermissions,
  onRoleChange,
  onPermissionsChange,
  disabled = false,
}: PermissionSelectorProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [customMode, setCustomMode] = useState(false);
  const [showPermissionInfo, setShowPermissionInfo] = useState(false);

  const groupedPermissions: Record<string, string[]> = {};
  const permissionLabels: Record<string, string> = {};
  for (const permModule of permissionCatalog) {
    groupedPermissions[permModule.key] = permModule.permissions.map((p) => p.key);
    for (const p of permModule.permissions) permissionLabels[p.key] = p.label;
  }

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
      newPermissions = selectedPermissions.filter((p) => !modulePerms.includes(p));
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
        <div className="mb-2 flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700">Role Template</label>
          {selectedRole && (
            <div className="relative">
              <button
                type="button"
                onMouseEnter={() => setShowPermissionInfo(true)}
                onMouseLeave={() => setShowPermissionInfo(false)}
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                <Info className="h-4 w-4" />
              </button>
              {showPermissionInfo && (
                <div className="absolute left-6 top-0 z-50 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                  <div className="text-sm">
                    <p className="mb-2 font-semibold text-gray-900">
                      {roleTemplates.find((t) => t.role === selectedRole)?.name} Permissions:
                    </p>
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {roleTemplates
                        .find((t) => t.role === selectedRole)
                        ?.permissions.map((perm) => (
                          <div key={perm} className="flex items-start gap-1 text-xs text-gray-600">
                            <Gauge className="mt-0.5 h-3.5 w-3.5 text-green-600" />
                            <span>{permissionLabels[perm] || perm}</span>
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
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:bg-gray-100"
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
          <p className="mt-2 text-sm font-medium text-amber-600">
            Custom permissions (modified from template)
          </p>
        )}
      </div>

      {/* Permission Checkboxes */}
      {selectedRole && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Permissions ({selectedPermissions.length} selected)
            </label>
            <button
              type="button"
              onClick={() =>
                expandedModules.size === 0
                  ? setExpandedModules(new Set(permissionCatalog.map((m) => m.key)))
                  : setExpandedModules(new Set())
              }
              className="text-sm text-green-600 hover:text-green-700"
            >
              {expandedModules.size === 0 ? "Expand All" : "Collapse All"}
            </button>
          </div>

          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200">
            {permissionCatalog.map((permModule) => {
              const moduleKey = permModule.key;
              const ModuleIcon = MODULE_ICONS[moduleKey] ?? KeyRound;
              const isExpanded = expandedModules.has(moduleKey);
              const isFullySelected = isModuleFullySelected(moduleKey);
              const isPartiallySelected = isModulePartiallySelected(moduleKey);
              const modulePerms = groupedPermissions[moduleKey] || [];

              return (
                <div key={moduleKey}>
                  {/* Module Header */}
                  <div className="flex items-center bg-gray-50 p-4 transition-colors hover:bg-gray-100">
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
                      className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => toggleModule(moduleKey)}
                      className="ml-3 flex flex-1 items-center justify-between text-left"
                    >
                      <span className="font-medium text-gray-900">
                        <span className="inline-flex items-center gap-2">
                          <ModuleIcon className="h-4 w-4" />
                          {permModule.name}
                        </span>
                      </span>
                      <svg
                        className={`h-5 w-5 text-gray-500 transition-transform ${
                          isExpanded ? "rotate-180 transform" : ""
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
                    <div className="space-y-2 bg-white p-4">
                      {modulePerms.map((permission) => (
                        <label
                          key={permission}
                          className="flex cursor-pointer items-center space-x-3 rounded p-2 transition-colors hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(permission)}
                            onChange={() => handlePermissionToggle(permission)}
                            disabled={disabled}
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:cursor-not-allowed"
                          />
                          <span className="text-sm text-gray-700">
                            {permissionLabels[permission] || permission}
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
