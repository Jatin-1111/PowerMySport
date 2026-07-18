"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { CITIES } from "../../data/sportProfiles";

export function CitySelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (city: string, tier: 1 | 2 | 3) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? CITIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : CITIES;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search your city..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-power-orange focus:ring-1 focus:ring-power-orange/20"
        />
      </div>

      <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto pr-1">
        {filtered.map((city) => {
          const selected = value === city.name;
          return (
            <button
              key={city.name}
              type="button"
              onClick={() => onChange(city.name, city.tier)}
              className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all duration-150 ${
                selected
                  ? "border-power-orange bg-power-orange/5 text-power-orange"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {city.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
