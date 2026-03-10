import type { Request, Response } from "express";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const isDev = process.env.NODE_ENV === "development";

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
      console.log(`[GEO] Fetching: ${url}`);
    }
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (isDev) {
        console.error(`[GEO] HTTP ${response.status}`);
      }
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (isDev) {
      console.log(
        `[GEO] Response received:`,
        JSON.stringify(data).substring(0, 200),
      );
    }
    return data;
  } catch (error) {
    if (isDev) {
      console.error(`[GEO] Fetch error:`, error);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const autocompleteLocation = async (req: Request, res: Response) => {
  const query = String(req.query.q || "").trim();
  if (!query) {
    return res.status(400).json({
      success: false,
      message: "Query is required",
      data: [],
    });
  }

  try {
    const cacheKey = `autocomplete:${query.toLowerCase()}`;
    const cached =
      getFromCache<Array<{ label: string; lat: number; lon: number }>>(
        cacheKey,
      );
    if (cached) {
      return res.json({
        success: true,
        message: "Locations fetched from cache",
        data: cached,
      });
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API key not configured",
        data: [],
      });
    }

    if (isDev) {
      console.log(`[GEO] Autocomplete query: "${query}"`);
    }
    const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      query,
    )}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}&region=in&components=country:in`;

    const googleData: any = await fetchJson(googleUrl);

    if (googleData?.status !== "OK") {
      if (isDev) {
        console.error(
          `[GEO] Google status: ${googleData?.status} - ${googleData?.error_message}`,
        );
      }
      return res.status(400).json({
        success: false,
        message: googleData?.error_message || "No results found",
        data: [],
      });
    }

    const predictions = (googleData.predictions || []).slice(0, 6);

    const resolved = await Promise.all(
      predictions.map(async (prediction: any) => {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
            prediction.place_id,
          )}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}&fields=geometry`;

          const detailsData: any = await fetchJson(detailsUrl);
          const location = detailsData?.result?.geometry?.location;
          if (!location) return null;

          return {
            label: prediction.description,
            lat: location.lat,
            lon: location.lng,
          };
        } catch {
          return null;
        }
      }),
    );

    const results = resolved.filter(
      (item): item is { label: string; lat: number; lon: number } =>
        item !== null,
    );

    setCache(cacheKey, results);

    if (isDev) {
      console.log(`[GEO] Total results: ${results.length}`);
    }
    return res.json({
      success: true,
      message: "Locations fetched from Google Places",
      data: results,
    });
  } catch (error) {
    if (isDev) {
      console.error(`[GEO] Autocomplete error:`, error);
    }
    return res.status(500).json({
      success: false,
      message: "Failed to fetch location suggestions",
      data: [],
    });
  }
};

export const geocodeAddress = async (req: Request, res: Response) => {
  const address = String(req.query.address || "").trim();
  if (!address) {
    return res.status(400).json({
      success: false,
      message: "Address is required",
      data: null,
    });
  }

  try {
    const cacheKey = `geocode:${address.toLowerCase()}`;
    const cached = getFromCache<{
      label: string;
      lat: number;
      lon: number;
    } | null>(cacheKey);
    if (cached !== null) {
      return res.json({
        success: true,
        message: "Geocode success (cache)",
        data: cached,
      });
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API key not configured",
        data: null,
      });
    }

    if (isDev) {
      console.log(`[GEO] Geocoding address: "${address}"`);
    }
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address,
    )}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}&region=in&components=country:in`;

    const googleData: any = await fetchJson(googleUrl);

    if (googleData?.status !== "OK" || !googleData?.results?.[0]) {
      if (isDev) {
        console.error(`[GEO] Geocode status: ${googleData?.status}`);
      }
      setCache(cacheKey, null);
      return res.json({
        success: true,
        message: "No results",
        data: null,
      });
    }

    const result = googleData.results[0];
    if (isDev) {
      console.log(`[GEO] Geocoded: ${result.formatted_address}`);
    }

    const payload = {
      label: result.formatted_address,
      lat: result.geometry.location.lat,
      lon: result.geometry.location.lng,
    };

    setCache(cacheKey, payload);

    return res.json({
      success: true,
      message: "Geocode success",
      data: payload,
    });
  } catch (error) {
    if (isDev) {
      console.error(`[GEO] Geocode error:`, error);
    }
    return res.status(500).json({
      success: false,
      message: "Failed to geocode address",
      data: null,
    });
  }
};

export const reverseGeocode = async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({
      success: false,
      message: "Latitude and longitude are required",
      data: null,
    });
  }

  try {
    const cacheKey = `reverse:${lat}:${lon}`;
    const cached = getFromCache<{
      label: string;
      lat: number;
      lon: number;
    } | null>(cacheKey);
    if (cached !== null) {
      return res.json({
        success: true,
        message: "Reverse geocode success (cache)",
        data: cached,
      });
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API key not configured",
        data: null,
      });
    }

    if (isDev) {
      console.log(`[GEO] Reverse geocoding: lat=${lat}, lon=${lon}`);
    }
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
      String(lat),
    )},${encodeURIComponent(String(lon))}&key=${encodeURIComponent(
      GOOGLE_PLACES_API_KEY,
    )}&region=in`;

    const googleData: any = await fetchJson(googleUrl);

    if (googleData?.status !== "OK" || !googleData?.results?.[0]) {
      if (isDev) {
        console.error(`[GEO] Reverse geocode status: ${googleData?.status}`);
      }
      setCache(cacheKey, null);
      return res.json({
        success: true,
        message: "No results",
        data: null,
      });
    }

    const result = googleData.results[0];
    if (isDev) {
      console.log(`[GEO] Reverse geocoded: ${result.formatted_address}`);
    }

    const payload = {
      label: result.formatted_address,
      lat,
      lon,
    };

    setCache(cacheKey, payload);

    return res.json({
      success: true,
      message: "Reverse geocode success",
      data: payload,
    });
  } catch (error) {
    if (isDev) {
      console.error(`[GEO] Reverse geocode error:`, error);
    }
    return res.status(500).json({
      success: false,
      message: "Failed to reverse geocode",
      data: null,
    });
  }
};
