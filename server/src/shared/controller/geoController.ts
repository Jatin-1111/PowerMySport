import type { Request, Response } from "express";
import redis from "../../config/redis";
import { normalizeStateName } from "../../constants/indianStates";
import { log as __rootLog } from "../../utils/logger";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
const log = __rootLog.child("geo");

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const isDev = process.env.NODE_ENV === "development";

// Pincodes are stable, so cache resolved lookups for a long time.
const PINCODE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type GeoCacheEntry = {
  expiresAt: number;
  data: unknown;
};

const geoCache = new Map<string, GeoCacheEntry>();
const GEO_CACHE_TTL_MS = 60 * 1000;

const getFromCache = <T>(key: string): T | null => {
  const cached = geoCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    geoCache.delete(key);
    return null;
  }
  return cached.data as T;
};

const setCache = (key: string, data: unknown): void => {
  geoCache.set(key, {
    expiresAt: Date.now() + GEO_CACHE_TTL_MS,
    data,
  });
};

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of geoCache.entries()) {
    if (value.expiresAt <= now) {
      geoCache.delete(key);
    }
  }
}, GEO_CACHE_TTL_MS).unref();

const fetchJson = async (url: string): Promise<any> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    if (isDev) {
      log.info(`[GEO] Fetching: ${url}`);
    }
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (isDev) {
        log.error(`[GEO] HTTP ${response.status}`);
      }
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (isDev) {
      log.info(`[GEO] Response received:`, JSON.stringify(data).substring(0, 200));
    }
    return data;
  } catch (error) {
    if (isDev) {
      log.error(`[GEO] Fetch error:`, error);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * GET /api/geo/pincode/:pincode
 *
 * Tier 1 of the address cascade: resolve city + state from a 6-digit Indian
 * pincode using the FREE India Post API (no key, no cost). Results are cached
 * in Redis (Tier 2) so repeat lookups never hit the network again. This covers
 * the large majority of Indian addresses for ₹0, keeping the paid Google layer
 * (autocompleteLocation, Tier 3) as a last resort.
 */
export const lookupPincode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const pincode = String(req.params.pincode || "").trim();

  if (!/^\d{6}$/.test(pincode)) {
    throw new AppError("A valid 6-digit pincode is required", 400);
  }

  const cacheKey = `geo:pincode:${pincode}`;

  // Tier 2 — cache (free after the first lookup)
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json({
        success: true,
        message: "Pincode resolved (cache)",
        data: JSON.parse(cached),
      });
      return;
    }
  } catch {
    // fail open — proceed to live lookup if Redis is unavailable
  }

  // Tier 1 — free India Post lookup
  const data: any = await fetchJson(`https://api.postalpincode.in/pincode/${pincode}`);
  const entry = Array.isArray(data) ? data[0] : null;
  const postOffice = entry?.Status === "Success" ? entry?.PostOffice?.[0] : null;

  if (!postOffice) {
    // Tier 3 extension point: a paid provider (e.g. the Google layer above)
    // could be consulted here for addresses India Post can't resolve. Left as
    // free-only to keep cost at zero.
    res.json({
      success: true,
      message: "No match for pincode",
      data: null,
    });
    return;
  }

  const payload = {
    pincode,
    city: postOffice.District || postOffice.Block || postOffice.Name || "",
    state: normalizeStateName(postOffice.State || ""),
    district: postOffice.District || "",
  };

  try {
    await redis.set(cacheKey, JSON.stringify(payload), "EX", PINCODE_CACHE_TTL_SECONDS);
  } catch {
    // fail open — caching is best effort
  }

  res.json({
    success: true,
    message: "Pincode resolved",
    data: payload,
  });
});

export const autocompleteLocation = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = String(req.query.q || "").trim();
    if (!query) {
      throw new AppError("Query is required", 400);
    }

    const cacheKey = `autocomplete:${query.toLowerCase()}`;
    const cached = getFromCache<
      Array<{
        label: string;
        lat: number;
        lon: number;
        placeId: string;
        city?: string;
        state?: string;
        pincode?: string;
      }>
    >(cacheKey);
    if (cached) {
      res.json({
        success: true,
        message: "Locations fetched from cache",
        data: cached,
      });
      return;
    }

    if (!GOOGLE_PLACES_API_KEY) {
      throw new AppError("Google Maps API key not configured", 500);
    }

    if (isDev) {
      log.info(`[GEO] Autocomplete query: "${query}"`);
    }
    const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      query
    )}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}&region=in&components=country:in`;

    const googleData: any = await fetchJson(googleUrl);

    if (googleData?.status !== "OK") {
      if (isDev) {
        log.error(`[GEO] Google status: ${googleData?.status} - ${googleData?.error_message}`);
      }
      throw new AppError(googleData?.error_message || "No results found", 400);
    }

    const predictions = (googleData.predictions || []).slice(0, 6);

    const resolved = await Promise.all(
      predictions.map(async (prediction: any) => {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
            prediction.place_id
          )}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}&fields=geometry,address_components,formatted_address,place_id`;

          const detailsData: any = await fetchJson(detailsUrl);
          const result = detailsData?.result;
          const location = result?.geometry?.location;
          if (!location) return null;

          const addressComponents: Array<{
            long_name?: string;
            short_name?: string;
            types?: string[];
          }> = result?.address_components || [];

          const getAddressComponent = (type: string): string | undefined => {
            const component = addressComponents.find((item) => (item.types || []).includes(type));
            return component?.long_name || component?.short_name;
          };

          const city =
            getAddressComponent("locality") ||
            getAddressComponent("administrative_area_level_2") ||
            getAddressComponent("sublocality") ||
            getAddressComponent("postal_town");
          const state = getAddressComponent("administrative_area_level_1");
          const pincode = getAddressComponent("postal_code");

          return {
            label: result?.formatted_address || prediction.description,
            lat: location.lat,
            lon: location.lng,
            placeId: result?.place_id || prediction.place_id,
            city,
            state,
            pincode,
          };
        } catch {
          return null;
        }
      })
    );

    const results = resolved.filter(
      (
        item
      ): item is {
        label: string;
        lat: number;
        lon: number;
        placeId: string;
        city?: string;
        state?: string;
        pincode?: string;
      } => item !== null
    );

    setCache(cacheKey, results);

    if (isDev) {
      log.info(`[GEO] Total results: ${results.length}`);
    }
    res.json({
      success: true,
      message: "Locations fetched from Google Places",
      data: results,
    });
  }
);

export const geocodeAddress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const address = String(req.query.address || "").trim();
  if (!address) {
    throw new AppError("Address is required", 400);
  }

  const cacheKey = `geocode:${address.toLowerCase()}`;
  const cached = getFromCache<{
    label: string;
    lat: number;
    lon: number;
  } | null>(cacheKey);
  if (cached !== null) {
    res.json({
      success: true,
      message: "Geocode success (cache)",
      data: cached,
    });
    return;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    throw new AppError("Google Maps API key not configured", 500);
  }

  if (isDev) {
    log.info(`[GEO] Geocoding address: "${address}"`);
  }
  const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}&region=in&components=country:in`;

  const googleData: any = await fetchJson(googleUrl);

  if (googleData?.status !== "OK" || !googleData?.results?.[0]) {
    if (isDev) {
      log.error(`[GEO] Geocode status: ${googleData?.status}`);
    }
    setCache(cacheKey, null);
    res.json({
      success: true,
      message: "No results",
      data: null,
    });
    return;
  }

  const result = googleData.results[0];
  if (isDev) {
    log.info(`[GEO] Geocoded: ${result.formatted_address}`);
  }

  const payload = {
    label: result.formatted_address,
    lat: result.geometry.location.lat,
    lon: result.geometry.location.lng,
  };

  setCache(cacheKey, payload);

  res.json({
    success: true,
    message: "Geocode success",
    data: payload,
  });
});

export const reverseGeocode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new AppError("Latitude and longitude are required", 400);
  }

  const cacheKey = `reverse:${lat}:${lon}`;
  const cached = getFromCache<{
    label: string;
    lat: number;
    lon: number;
  } | null>(cacheKey);
  if (cached !== null) {
    res.json({
      success: true,
      message: "Reverse geocode success (cache)",
      data: cached,
    });
    return;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    throw new AppError("Google Maps API key not configured", 500);
  }

  if (isDev) {
    log.info(`[GEO] Reverse geocoding: lat=${lat}, lon=${lon}`);
  }
  const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
    String(lat)
  )},${encodeURIComponent(String(lon))}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}&region=in`;

  const googleData: any = await fetchJson(googleUrl);

  if (googleData?.status !== "OK" || !googleData?.results?.[0]) {
    if (isDev) {
      log.error(`[GEO] Reverse geocode status: ${googleData?.status}`);
    }
    setCache(cacheKey, null);
    res.json({
      success: true,
      message: "No results",
      data: null,
    });
    return;
  }

  const result = googleData.results[0];
  if (isDev) {
    log.info(`[GEO] Reverse geocoded: ${result.formatted_address}`);
  }

  const payload = {
    label: result.formatted_address,
    lat,
    lon,
  };

  setCache(cacheKey, payload);

  res.json({
    success: true,
    message: "Reverse geocode success",
    data: payload,
  });
});
