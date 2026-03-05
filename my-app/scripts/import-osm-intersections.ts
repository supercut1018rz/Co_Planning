import { query } from "../lib/db";

type OverpassElement = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
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
  return (await res.json()) as { elements: OverpassElement[] };
}

function toBool(v?: string) {
  if (!v) return false;
  return v === "yes" || v === "true" || v === "1";
}

async function main() {
  console.log("🚦 Importing Howard County intersections/nodes (OSM)...");

  const b = await query(
    "SELECT ST_AsText(geom) AS wkt FROM public.county_boundary WHERE name = $1 LIMIT 1",
    ["Howard County"]
  );
  if (b.rowCount === 0) throw new Error("county_boundary missing: Howard County");
  const wkt = b.rows[0].wkt as string;

  const bboxRes = await query(
    "SELECT ST_XMin(geom) AS xmin, ST_YMin(geom) AS ymin, ST_XMax(geom) AS xmax, ST_YMax(geom) AS ymax FROM (SELECT geom FROM public.county_boundary WHERE name=$1 LIMIT 1) t",
    ["Howard County"]
  );
  const { xmin, ymin, xmax, ymax } = bboxRes.rows[0];

  const q = `
[out:json][timeout:180];
(
  node["highway"="traffic_signals"](${ymin},${xmin},${ymax},${xmax});
  node["highway"="crossing"](${ymin},${xmin},${ymax},${xmax});
  node["crossing"](${ymin},${xmin},${ymax},${xmax});
  node["junction"](${ymin},${xmin},${ymax},${xmax});
);
out body;
`;

  console.log("🔍 Querying Overpass (may take 1-3 min)...");
  const data = await overpass(q);
  const nodes = data.elements.filter((e) => e.type === "node");

  console.log(`✅ Got ${nodes.length} nodes, writing to DB...`);

  // Keep only points inside county_boundary (bbox can include outside)
  await query("TRUNCATE TABLE public.intersections_howard");

  let inserted = 0;
  for (const n of nodes) {
    const tags = n.tags || {};
    const traffic_signals = tags.highway === "traffic_signals";
    const crossing = tags.highway === "crossing" || !!tags.crossing;

    // Check if point is inside Howard boundary
    const inside = await query(
      `SELECT ST_Contains((SELECT geom FROM public.county_boundary WHERE name=$1 LIMIT 1),
                          ST_SetSRID(ST_Point($2,$3),4326)) AS ok`,
      ["Howard County", n.lon, n.lat]
    );
    if (!inside.rows[0].ok) continue;

    await query(
      `INSERT INTO public.intersections_howard
       (osm_id, name, traffic_signals, crossing, geom, properties)
       VALUES ($1,$2,$3,$4, ST_SetSRID(ST_Point($5,$6),4326), $7::jsonb)`,
      [
        n.id,
        tags.name || null,
        traffic_signals,
        crossing,
        n.lon,
        n.lat,
        JSON.stringify(tags),
      ]
    );
    inserted++;
  }

  console.log(`🎉 Import done: wrote ${inserted} intersections`);
}

main().catch((e) => {
  console.error("❌ Import failed:", e);
  process.exit(1);
});
