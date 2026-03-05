import { query } from "../lib/db";


type OverpassWay = {
  type: "way";
  id: number;
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
};

async function overpass(queryStr: string) {
  const url = "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams({ data: queryStr }).toString(),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return (await res.json()) as { elements: OverpassWay[] };
}

function parseWidthMeters(tags: Record<string, string>): number | null {
  const w = tags.width || tags["width:meters"] || tags["width:meter"];
  if (!w) return null;
  const m = String(w).match(/(\d+(\.\d+)?)/);
  if (!m) return null;
  const val = parseFloat(m[1]);
  if (!Number.isFinite(val)) return null;
  if (val < 0.3 || val > 20) return null;
  return val;
}

async function main() {
  console.log("🚶 Importing Howard County walkways (OSM)...");

  // bbox from boundary
  const bboxRes = await query(
    "SELECT ST_XMin(geom) AS xmin, ST_YMin(geom) AS ymin, ST_XMax(geom) AS xmax, ST_YMax(geom) AS ymax FROM (SELECT geom FROM public.county_boundary WHERE name=$1 LIMIT 1) t",
    ["Howard County"]
  );
  if (bboxRes.rowCount === 0) throw new Error("county_boundary missing: Howard County");
  const { xmin, ymin, xmax, ymax } = bboxRes.rows[0];

  // Overpass: footways/paths/pedestrian/steps + cycleway; remove cycleway for pedestrian-only
  const q = `
[out:json][timeout:240];
(
  way["highway"~"footway|path|pedestrian|steps|cycleway"](${ymin},${xmin},${ymax},${xmax});
);
out body geom;
`;

  console.log("🔍 Querying Overpass (may take 2-5 min)...");
  const data = await overpass(q);
  const ways = data.elements.filter((e) => e.type === "way" && e.geometry && e.geometry.length >= 2);

  console.log(`✅ Got ${ways.length} walkways, writing to DB...`);

  await query(
    "DELETE FROM public.sidewalks_howard WHERE scenario='base' AND source='osm'",
    []
  );
  console.log("🗑️  Cleared existing base/osm walkways");

  let inserted = 0;

  for (const w of ways) {
    const tags = w.tags || {};
    const name = tags.name || null;
    const surface = tags.surface || null;

    const side = tags.sidewalk ? String(tags.sidewalk) : "centerline";

    const width = parseWidthMeters(tags) ?? 1.5;

    // line geometry
    const coords = w.geometry!.map((p) => `${p.lon} ${p.lat}`).join(", ");
    const wkt = `LINESTRING(${coords})`;

    const inside = await query(
      `
      SELECT ST_Intersects(
        (SELECT geom FROM public.county_boundary WHERE name=$1 LIMIT 1),
        ST_SetSRID(ST_GeomFromText($2), 4326)
      ) AS ok
      `,
      ["Howard County", wkt]
    );
    if (!inside.rows[0].ok) continue;

    await query(
      `
      INSERT INTO public.sidewalks_howard
        (name, side, width_m, surface, source, road_id, scenario, status, properties, geom)
      VALUES
        ($1, $2, $3, $4, 'osm', NULL, 'base', 'existing', $5::jsonb, ST_SetSRID(ST_GeomFromText($6),4326))
      `,
      [name, side, width, surface, JSON.stringify(tags), wkt]
    );

    inserted++;
  }

  console.log(`🎉 Import done: wrote ${inserted} walkways to sidewalks_howard (source=osm)`);
}

main().catch((e) => {
  console.error("❌ Import failed:", e);
  process.exit(1);
});
