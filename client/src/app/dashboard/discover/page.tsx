"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { discoveryApi } from "@/lib/discovery";
import { Coach, Venue } from "@/types";
import { MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DiscoverPage() {
  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [searchMode, setSearchMode] = useState<"universal" | "nearby">("universal");
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [sportFilter, setSportFilter] = useState("");
  
  const router = useRouter();

  // Load universal feed on mount
  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    try {
      // Call API without location params to get Universal Feed
      const params: any = {};
      if (sportFilter) params.sport = sportFilter;
      
      const response = await discoveryApi.searchNearby(params as any);
      if (response.success && response.data) {
        setVenues(response.data.venues);
        setCoaches(response.data.coaches);
        setSearchMode("universal");
      }
    } catch (error) {
      console.error("Feed load failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFindNearMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        
        try {
          const response = await discoveryApi.searchNearby({
            latitude,
            longitude,
            maxDistance: 10, // Default 10km
            sport: sportFilter
          });
          
          if (response.success && response.data) {
            setVenues(response.data.venues);
            setCoaches(response.data.coaches);
            setSearchMode("nearby");
          }
        } catch (error) {
          console.error("Nearby search failed:", error);
          alert("Failed to find nearby items.");
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Unable to retrieve your location. Showing all items instead.");
        setLoading(false);
      }
    );
  };

  const handleSportSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchMode === "nearby" && userLocation) {
      // Re-run nearby search with new sport
      // logic similar to handleFindNearMe but reusing userLocation
       // Simplified for MVP: just reload universal or nearby logic
       handleFindNearMe(); // Refresh nearby with new filter
    } else {
      loadFeed(); // Refresh universal with new filter
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
           <h1 className="text-3xl font-bold text-slate-900">
            {searchMode === "nearby" ? "Venues & Coaches Near You" : "Discover Venues & Coaches"}
          </h1>
          <p className="text-slate-600 mt-1">
            {searchMode === "nearby" 
              ? "Showing results within 10km" 
              : "Showing all top rated coaches and venues"}
          </p>
        </div>
       
        <div className="flex gap-2">
            {searchMode === "nearby" && (
                <Button 
                    variant="outline" 
                    onClick={loadFeed}
                    className="flex items-center gap-2"
                >
                    Show All
                </Button>
            )}
            <Button 
                variant={searchMode === "nearby" ? "primary" : "outline"}
                onClick={handleFindNearMe}
                className="flex items-center gap-2"
            >
                <MapPin size={18} />
                Find Near Me
            </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="bg-white mb-8 p-4">
        <form onSubmit={handleSportSearch} className="flex gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    value={sportFilter}
                    onChange={(e) => setSportFilter(e.target.value)}
                    placeholder="Search by sport (e.g. Cricket, Tennis)..."
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 bg-white text-slate-900"
                />
            </div>
            <Button type="submit" variant="primary">
                Search
            </Button>
        </form>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-power-orange mx-auto mb-4"></div>
            <p className="text-slate-600">Loading discovery feed...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
            {/* Venues */}
            <div>
            <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                <span>🏟️</span> Venues ({venues.length})
            </h2>
            <div className="space-y-4">
                {venues.map((venue) => (
                <Card
                    key={venue.id}
                    className="bg-white hover:shadow-lg transition-shadow overflow-hidden"
                >
                     {venue.images && venue.images.length > 0 && (
                        <div className="h-40 w-full overflow-hidden">
                            <img src={venue.images[0]} alt={venue.name} className="w-full h-full object-cover" />
                        </div>
                    )}
                    <div className="p-4">
                        <h3 className="text-lg font-semibold text-slate-900">
                        {venue.name}
                        </h3>
                        <p className="text-sm text-slate-600 mb-2">
                        {venue.sports.join(", ")}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-power-orange font-bold">
                            ₹{venue.pricePerHour}/hr
                            </p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => router.push(`/dashboard/book/${venue.id}`)} // Assuming venue booking page exists
                            >
                                Book
                            </Button>
                        </div>
                    </div>
                </Card>
                ))}
                {venues.length === 0 && (
                <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <p className="text-slate-500">No venues found.</p>
                </div>
                )}
            </div>
            </div>

            {/* Coaches */}
            <div>
            <h2 className="text-2xl font-bold mb-4 text-slate-900 flex items-center gap-2">
                <span>👨‍🏫</span> Coaches ({coaches.length})
            </h2>
            <div className="space-y-4">
                {coaches.map((coach) => (
                <Card
                    key={coach.id}
                    className="bg-white hover:shadow-lg transition-shadow p-4"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                            Coach {coach.sports[0]}
                            </h3>
                            <p className="text-sm text-slate-600 mb-1">
                            {coach.sports.join(", ")} • {coach.serviceMode}
                            </p>
                            <div className="flex items-center gap-1 mb-2">
                                <span className="text-yellow-500">⭐</span>
                                <span className="text-slate-700 font-medium">{coach.rating.toFixed(1)}</span>
                                <span className="text-slate-500 text-sm">({coach.reviewCount} reviews)</span>
                            </div>
                        </div>
                        <div className="text-right">
                             <p className="text-power-orange font-bold text-lg">
                                ₹{coach.hourlyRate}
                            </p>
                            <p className="text-xs text-slate-500">/hour</p>
                        </div>
                    </div>
                    
                    <Button
                    variant="outline"
                    className="w-full mt-3 border-power-orange text-power-orange hover:bg-power-orange hover:text-white"
                    onClick={() => router.push(`/dashboard/coaches/${coach.id}`)}
                    >
                    Book Coach
                    </Button>
                </Card>
                ))}
                {coaches.length === 0 && (
                <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <p className="text-slate-500">No coaches available.</p>
                </div>
                )}
            </div>
            </div>
        </div>
      )}
    </div>
  );
}
