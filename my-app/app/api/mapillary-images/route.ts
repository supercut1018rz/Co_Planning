import { NextRequest, NextResponse } from 'next/server';

interface MapillaryImage {
  id: string;
  thumb_256_url: string;
  thumb_1024_url: string;
  thumb_2048_url: string;
  computed_compass_angle: number;
  lat: number;
  lng: number;
}

interface MapillaryResponse {
  data: Array<{
    id: string;
    image: {
      id: string;
      thumb_256_url: string;
      thumb_1024_url: string;
      thumb_2048_url: string;
      computed_compass_angle: number;
      geometry: {
        coordinates: [number, number];
      };
    };
  }>;
}

// Mapillary GraphQL API endpoint
const MAPILLARY_API = 'https://graph.mapillary.com/images';

/**
 * Get the cardinal direction from a compass angle (0-360 degrees)
 */
function getDirection(angle: number): string {
  // Normalize angle to 0-360
  const normalized = ((angle % 360) + 360) % 360;
  
  // N: 315-45, E: 45-135, S: 135-225, W: 225-315
  if (normalized >= 315 || normalized < 45) return 'N';
  if (normalized >= 45 && normalized < 135) return 'E';
  if (normalized >= 135 && normalized < 225) return 'S';
  if (normalized >= 225 && normalized < 315) return 'W';
  return 'N';
}

/**
 * Find closest image to target direction from a list of images
 */
function findClosestToDirection(
  images: MapillaryImage[],
  targetDirection: string
): MapillaryImage | null {
  const targetAngles: { [key: string]: number } = {
    'N': 0,
    'E': 90,
    'S': 180,
    'W': 270,
  };

  const targetAngle = targetAngles[targetDirection];
  
  let closest: MapillaryImage | null = null;
  let minDiff = Infinity;

  for (const img of images) {
    const diff = Math.abs(img.computed_compass_angle - targetAngle);
    const normalizedDiff = Math.min(diff, 360 - diff); // Handle wraparound

    if (normalizedDiff < minDiff) {
      minDiff = normalizedDiff;
      closest = img;
    }
  }

  return closest;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    // Use Mapillary GraphQL API to search for images near the location
    // Search within ~100 meters radius
    const radius = 100; // meters
    
    // Build bbox (bounding box) around the point
    // Format: minLng,minLat,maxLng,maxLat
    // Rough approximation: 1 degree lat ≈ 111km, so 100m ≈ 0.0009 degrees
    const delta = radius / 111000; // Convert meters to degrees
    const minLng = lng - delta;
    const minLat = lat - delta;
    const maxLng = lng + delta;
    const maxLat = lat + delta;
    const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;

    // Mapillary uses access token, but for public access we can try without
    // If needed, user can add MAPILLARY_CLIENT_TOKEN to .env.local
    const accessToken = process.env.MAPILLARY_CLIENT_TOKEN || '';
    
    // Use REST API endpoint (Mapillary v4)
    // Format: https://graph.mapillary.com/images?fields=...&bbox=minLng,minLat,maxLng,maxLat&limit=...
    const url = new URL(MAPILLARY_API);
    url.searchParams.set('fields', 'id,thumb_256_url,thumb_1024_url,thumb_2048_url,computed_compass_angle,geometry');
    url.searchParams.set('bbox', bbox);
    url.searchParams.set('limit', '50'); // Get more images to filter by direction
    
    if (accessToken) {
      url.searchParams.set('access_token', accessToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // If API fails, return empty result (Mapillary might require token or have rate limits)
      console.warn('Mapillary API request failed:', response.status, response.statusText);
      return NextResponse.json({
        images: {},
        message: 'No street view images available at this location'
      });
    }

    const data = await response.json();

    // Mapillary API returns data in format: { data: [...] } where each item has the requested fields directly
    // Transform response to our format
    const images: MapillaryImage[] = (data.data || []).map((item: any) => {
      // Handle both GraphQL nested format and REST direct format
      const imageData = item.image || item;
      const geometry = imageData.geometry || item.geometry;
      const coords = geometry?.coordinates || [lng, lat]; // GeoJSON format: [lng, lat]
      
      return {
        id: imageData.id || item.id,
        thumb_256_url: imageData.thumb_256_url || item.thumb_256_url || '',
        thumb_1024_url: imageData.thumb_1024_url || item.thumb_1024_url || imageData.thumb_256_url || item.thumb_256_url || '',
        thumb_2048_url: imageData.thumb_2048_url || item.thumb_2048_url || imageData.thumb_1024_url || item.thumb_1024_url || '',
        computed_compass_angle: imageData.computed_compass_angle ?? item.computed_compass_angle ?? 0,
        lat: coords[1] || lat,
        lng: coords[0] || lng,
      };
    }).filter((img: MapillaryImage) => img.thumb_256_url || img.thumb_1024_url); // Filter out images without URLs

    // Filter and find closest image for each direction (N, E, S, W)
    const directions = ['N', 'E', 'S', 'W'];
    const result: { [key: string]: MapillaryImage | null } = {};

    for (const direction of directions) {
      result[direction] = findClosestToDirection(images, direction);
    }

    return NextResponse.json({
      images: result,
      totalFound: images.length,
    });

  } catch (error: any) {
    console.error('Error fetching Mapillary images:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch street view images',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

