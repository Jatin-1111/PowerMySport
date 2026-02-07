import type { Request, Response } from "express";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const fetchJson = async (url: string): Promise<any> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    console.log(`[GEO] Fetching: ${url}`);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[GEO] HTTP ${response.status}`);
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log(
      `[GEO] Response received:`,
      JSON.stringify(data).substring(0, 200),
    );
    return data;
  } catch (error) {
    console.error(`[GEO] Fetch error:`, error);
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
    });
  }

  try {
    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API key not configured",
      });
    }

    console.log(`[GEO] Autocomplete query: "${query}"`);
    const googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      query,
    )}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}&region=in&components=country:in`;

    const googleData: any = await fetchJson(googleUrl);

    if (googleData?.status !== "OK") {
      console.error(
        `[GEO] Google status: ${googleData?.status} - ${googleData?.error_message}`,
      );
      return res.status(400).json({
        success: false,
        message: googleData?.error_message || "No results found",
      });
    }

    const results: Array<{ label: string; lat: number; lon: number }> = [];

    for (const prediction of googleData.predictions || []) {
      try {
        console.log(`[GEO] Fetching details for place: ${prediction.place_id}`);
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
          prediction.place_id,
        )}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}&fields=geometry,formatted_address`;

        const detailsData: any = await fetchJson(detailsUrl);

        if (detailsData?.result?.geometry?.location) {
          results.push({
            label: prediction.description,
            lat: detailsData.result.geometry.location.lat,
            lon: detailsData.result.geometry.location.lng,
          });
          console.log(`[GEO] Added result: ${prediction.description}`);
        }
      } catch (err) {
        console.error(`[GEO] Details fetch failed:`, err);
      }
    }

    console.log(`[GEO] Total results: ${results.length}`);
    return res.json({
      success: true,
      message: "Locations fetched from Google Places",
      data: results.slice(0, 6),
    });
  } catch (error) {
    console.error(`[GEO] Autocomplete error:`, error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch location suggestions",
    });
  }
};

export const geocodeAddress = async (req: Request, res: Response) => {
  const address = String(req.query.address || "").trim();
  if (!address) {
    return res.status(400).json({
      success: false,
      message: "Address is required",
    });
  }

  try {
    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API key not configured",
      });
    }

    console.log(`[GEO] Geocoding address: "${address}"`);
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address,
    )}&key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}&region=in&components=country:in`;

    const googleData: any = await fetchJson(googleUrl);

    if (googleData?.status !== "OK" || !googleData?.results?.[0]) {
      console.error(`[GEO] Geocode status: ${googleData?.status}`);
      return res.json({
        success: true,
        message: "No results",
        data: null,
      });
    }

    const result = googleData.results[0];
    console.log(`[GEO] Geocoded: ${result.formatted_address}`);

    return res.json({
      success: true,
      message: "Geocode success",
      data: {
        label: result.formatted_address,
        lat: result.geometry.location.lat,
        lon: result.geometry.location.lng,
      },
    });
  } catch (error) {
    console.error(`[GEO] Geocode error:`, error);
    return res.status(500).json({
      success: false,
      message: "Failed to geocode address",
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
    });
  }

  try {
    if (!GOOGLE_PLACES_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Google Maps API key not configured",
      });
    }

    console.log(`[GEO] Reverse geocoding: lat=${lat}, lon=${lon}`);
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
      String(lat),
    )},${encodeURIComponent(String(lon))}&key=${encodeURIComponent(
      GOOGLE_PLACES_API_KEY,
    )}&region=in`;

    const googleData: any = await fetchJson(googleUrl);

    if (googleData?.status !== "OK" || !googleData?.results?.[0]) {
      console.error(`[GEO] Reverse geocode status: ${googleData?.status}`);
      return res.json({
        success: true,
        message: "No results",
        data: null,
      });
    }

    const result = googleData.results[0];
    console.log(`[GEO] Reverse geocoded: ${result.formatted_address}`);

    return res.json({
      success: true,
      message: "Reverse geocode success",
      data: {
        label: result.formatted_address,
        lat,
        lon,
      },
    });
  } catch (error) {
    console.error(`[GEO] Reverse geocode error:`, error);
    return res.status(500).json({
      success: false,
      message: "Failed to reverse geocode",
    });
  }
};
