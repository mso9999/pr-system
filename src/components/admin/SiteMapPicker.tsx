import { Alert, Box, Stack, Typography } from "@mui/material";
import { collection, getDocs } from "firebase/firestore";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { db } from "../../config/firebase";

/** Same radius the server applies in checkSiteConflicts / ingestUgpSite. */
export const SITE_PROXIMITY_WARN_M = 300;

export interface MapSite {
  id: string;
  code: string;
  name: string;
  organizationId: string;
  latitude: number;
  longitude: number;
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function sitesNear(sites: MapSite[], lat: number, lng: number, excludeId?: string): (MapSite & { distanceM: number })[] {
  return sites
    .filter((s) => s.id !== excludeId)
    .map((s) => ({ ...s, distanceM: Math.round(distanceMeters(lat, lng, s.latitude, s.longitude)) }))
    .filter((s) => s.distanceM <= SITE_PROXIMITY_WARN_M)
    .sort((a, b) => a.distanceM - b.distanceM);
}

function ClickToPick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))),
  });
  return null;
}

function FitOnce({ sites, picked }: { sites: MapSite[]; picked: [number, number] | null }) {
  const map = useMap();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) return;
    if (picked) {
      map.setView(picked, 14);
      setDone(true);
    } else if (sites.length) {
      map.fitBounds(sites.map((s) => [s.latitude, s.longitude] as [number, number]), { padding: [20, 20] });
      setDone(true);
    }
  }, [done, map, picked, sites]);
  return null;
}

interface SiteMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  excludeId?: string;
  onPick: (lat: number, lng: number) => void;
}

/**
 * Site location picker over the Nexus all-sites list. Every site with GPS is a
 * pin; picking a point within SITE_PROXIMITY_WARN_M of one shows which sites
 * are nearby (the save step asks for an explicit "not a duplicate").
 */
export function SiteMapPicker({ latitude, longitude, excludeId, onPick }: SiteMapPickerProps) {
  const [sites, setSites] = useState<MapSite[]>([]);

  useEffect(() => {
    getDocs(collection(db, "referenceData_sites"))
      .then((snap) => {
        const rows: MapSite[] = [];
        snap.forEach((d) => {
          const x = d.data() as Record<string, unknown>;
          const lat = Number(x.latitude);
          const lng = Number(x.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || x.latitude == null || x.longitude == null) return;
          rows.push({
            id: d.id,
            code: String(x.code || ""),
            name: String(x.name || ""),
            organizationId: String(x.organizationId || ""),
            latitude: lat,
            longitude: lng,
          });
        });
        setSites(rows);
      })
      .catch(() => setSites([]));
  }, []);

  const picked: [number, number] | null =
    latitude != null && longitude != null && !(latitude === 0 && longitude === 0) ? [latitude, longitude] : null;
  const nearby = useMemo(
    () => (picked ? sitesNear(sites, picked[0], picked[1], excludeId) : []),
    [sites, picked, excludeId]
  );

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary">
        Click the map to set the site location. Pins are existing sites in the Nexus list; fine-tune with the
        latitude/longitude fields if needed.
      </Typography>
      <Box sx={{ height: 320, borderRadius: 1, overflow: "hidden", border: "1px solid", borderColor: "divider" }}>
        <MapContainer center={[0, 20]} zoom={3} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <FitOnce sites={sites} picked={picked} />
          <ClickToPick onPick={onPick} />
          {sites
            .filter((s) => s.id !== excludeId)
            .map((s) => (
              <CircleMarker
                key={s.id}
                center={[s.latitude, s.longitude]}
                radius={6}
                pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.8, weight: 1 }}
              >
                <Tooltip>{`${s.code} — ${s.name} (${s.organizationId})`}</Tooltip>
              </CircleMarker>
            ))}
          {picked && (
            <CircleMarker
              center={picked}
              radius={9}
              pathOptions={{ color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 0.9, weight: 2 }}
            >
              <Tooltip permanent direction="top">This site</Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      </Box>
      {nearby.length > 0 && (
        <Alert severity="warning">
          {`Within ${SITE_PROXIMITY_WARN_M} m: `}
          {nearby.map((s) => `${s.code} — ${s.name} (${s.distanceM} m)`).join("; ")}
          {". Make sure you are not duplicating an existing site; you will be asked to confirm on save."}
        </Alert>
      )}
    </Stack>
  );
}
