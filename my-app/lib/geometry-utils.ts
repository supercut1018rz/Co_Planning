import * as turf from '@turf/turf';

/**
 * Compute road bearing (degrees 0-360).
 * @param line LineString geometry
 * @returns bearing in degrees (0-360)
 */
export function calculateBearing(line: GeoJSON.Feature<GeoJSON.LineString>): number {
  const coords = line.geometry.coordinates;
  const start = turf.point(coords[0]);
  const end = turf.point(coords[coords.length - 1]);
  return turf.bearing(start, end);
}

/**
 * Compute offset sign from bearing and side (left/right/north/south/east/west).
 * @param bearing road bearing
 * @param side left, right, north, south, east, west
 * @returns 1 or -1
 */
export function calculateOffsetSign(bearing: number, side: string): number {
  const normalizedBearing = ((bearing % 360) + 360) % 360;
  
  switch (side.toLowerCase()) {
    case 'left':
      return -1;
    case 'right':
      return 1;
    case 'north':
      return (normalizedBearing > 45 && normalizedBearing < 135) ||
             (normalizedBearing > 225 && normalizedBearing < 315) ? -1 : 1;
    case 'south':
      return (normalizedBearing > 45 && normalizedBearing < 135) ||
             (normalizedBearing > 225 && normalizedBearing < 315) ? 1 : -1;
    case 'east':
      return (normalizedBearing > 315 || normalizedBearing < 45) ||
             (normalizedBearing > 135 && normalizedBearing < 225) ? 1 : -1;
    case 'west':
      return (normalizedBearing > 315 || normalizedBearing < 45) ||
             (normalizedBearing > 135 && normalizedBearing < 225) ? -1 : 1;
    default:
      return 1;
  }
}

/**
 * Generate sidewalk geometry (lineOffset).
 * @param roadLine road centerline
 * @param offsetMeters offset in meters
 * @param side direction
 * @returns offset LineString
 */
export function generateSidewalkGeometry(
  roadLine: GeoJSON.Feature<GeoJSON.LineString>,
  offsetMeters: number,
  side?: string
): GeoJSON.Feature<GeoJSON.LineString> {
  const bearing = calculateBearing(roadLine);
  const offsetSign = side ? calculateOffsetSign(bearing, side) : 1;
  const signedOffset = offsetMeters * offsetSign;
  
  try {
    // Turf lineOffset; Turf uses kilometers
    const offsetLine = turf.lineOffset(roadLine, signedOffset / 1000, { units: 'kilometers' });
    return offsetLine;
  } catch (error) {
    console.error('Error generating sidewalk geometry:', error);
    return roadLine;
  }
}

/**
 * Extract a road segment.
 * @param roadLine full road line
 * @param startPoint start (coordinate or fraction 0-1)
 * @param endPoint end
 * @returns segment
 */
export function extractRoadSegment(
  roadLine: GeoJSON.Feature<GeoJSON.LineString>,
  startPoint: GeoJSON.Feature<GeoJSON.Point> | number,
  endPoint: GeoJSON.Feature<GeoJSON.Point> | number
): GeoJSON.Feature<GeoJSON.LineString> {
  let startFraction: number;
  let endFraction: number;
  
  if (typeof startPoint === 'number') {
    startFraction = startPoint;
  } else {
    startFraction = turf.nearestPointOnLine(roadLine, startPoint).properties.location || 0;
  }
  
  if (typeof endPoint === 'number') {
    endFraction = endPoint;
  } else {
    endFraction = turf.nearestPointOnLine(roadLine, endPoint).properties.location || 1;
  }
  
  const [minFraction, maxFraction] = [
    Math.min(startFraction, endFraction),
    Math.max(startFraction, endFraction)
  ];
  
  const startCoord = turf.along(roadLine, minFraction * turf.length(roadLine), { units: 'kilometers' });
  const endCoord = turf.along(roadLine, maxFraction * turf.length(roadLine), { units: 'kilometers' });
  
  return turf.lineSlice(startCoord, endCoord, roadLine);
}

/**
 * Smooth a line (optional).
 * @param line input line
 * @returns smoothed line
 */
export function smoothLine(line: GeoJSON.Feature<GeoJSON.LineString>): GeoJSON.Feature<GeoJSON.LineString> {
  try {
    const smoothed = turf.bezierSpline(line);
    return smoothed;
  } catch (error) {
    console.warn('Could not smooth line, returning original:', error);
    return line;
  }
}

/**
 * Snap point to nearest of target points.
 * @param point input point
 * @param targetPoints target points
 * @param maxDistance max snap distance (meters)
 * @returns snapped point or original if none within maxDistance
 */
export function snapToNearestPoint(
  point: GeoJSON.Feature<GeoJSON.Point>,
  targetPoints: GeoJSON.Feature<GeoJSON.Point>[],
  maxDistance: number = 50
): GeoJSON.Feature<GeoJSON.Point> {
  let nearestPoint = point;
  let minDistance = Infinity;
  
  for (const target of targetPoints) {
    const distance = turf.distance(point, target, { units: 'meters' });
    if (distance < minDistance && distance < maxDistance) {
      minDistance = distance;
      nearestPoint = target;
    }
  }
  
  return nearestPoint;
}

/**
 * Check if point is inside polygon.
 */
export function isPointInPolygon(
  point: GeoJSON.Feature<GeoJSON.Point>,
  polygon: GeoJSON.Feature<GeoJSON.Polygon>
): boolean {
  return turf.booleanPointInPolygon(point, polygon);
}

/**
 * Convert PostGIS geometry (WKT or GeoJSON string) to GeoJSON.
 * @param wkt Well-Known Text or GeoJSON string
 * @returns GeoJSON geometry
 */
export function wktToGeoJSON(wkt: string): any {
  try {
    if (typeof wkt === 'string' && wkt.startsWith('{')) {
      return JSON.parse(wkt);
    }
    return wkt;
  } catch (error) {
    console.error('Error parsing WKT:', error);
    return null;
  }
}

