import { Building2, ImageOff, Layout, Star } from "lucide-react";

interface VenueStatsBarProps {
  totalVenues: number;
  totalSports: number;
  venuesWithPhotos: number;
  avgRating: number | null;
}

export function VenueStatsBar({
  totalVenues,
  totalSports,
  venuesWithPhotos,
  avgRating,
}: VenueStatsBarProps) {
  const stats = [
    {
      label: "Total Venues",
      value: totalVenues,
      icon: <Building2 className="h-4 w-4" />,
      color: "text-power-orange",
      bg: "bg-orange-50",
    },
    {
      label: "Sports Offered",
      value: totalSports,
      icon: <Layout className="h-4 w-4" />,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
    },
    {
      label: "With Photos",
      value: venuesWithPhotos,
      icon: <ImageOff className="h-4 w-4" />,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Avg Rating",
      value: avgRating !== null ? avgRating.toFixed(1) : "—",
      icon: <Star className="h-4 w-4" />,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
        >
          <div
            className={`h-9 w-9 rounded-lg ${stat.bg} ${stat.color} flex shrink-0 items-center justify-center`}
          >
            {stat.icon}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-slate-900">{stat.value}</p>
            <p className="truncate text-xs text-slate-500">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
