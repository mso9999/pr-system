import { Box, Button, Stack, Typography } from "@mui/material";
import { useMemo } from "react";

interface SimpleMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onPick: (lat: number, lng: number) => void;
}

const MAP_WIDTH = 560;
const MAP_HEIGHT = 280;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function xyToLatLng(x: number, y: number): { lat: number; lng: number } {
  const lng = (x / MAP_WIDTH) * 360 - 180;
  const lat = 90 - (y / MAP_HEIGHT) * 180;
  return {
    lat: Number(clamp(lat, -90, 90).toFixed(6)),
    lng: Number(clamp(lng, -180, 180).toFixed(6)),
  };
}

function latLngToXY(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * MAP_WIDTH;
  const y = ((90 - lat) / 180) * MAP_HEIGHT;
  return { x: clamp(x, 0, MAP_WIDTH), y: clamp(y, 0, MAP_HEIGHT) };
}

export function SimpleMapPicker({ latitude, longitude, onPick }: SimpleMapPickerProps) {
  const marker = useMemo(() => {
    if (latitude == null || longitude == null) return null;
    return latLngToXY(latitude, longitude);
  }, [latitude, longitude]);

  return (
    <Stack spacing={1.25} sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary">
        Click on the map to set site coordinates. Then fine-tune using latitude/longitude fields if needed.
      </Typography>
      <Box
        role="button"
        aria-label="Map picker"
        tabIndex={0}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const next = xyToLatLng(x, y);
          onPick(next.lat, next.lng);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          const target = e.currentTarget.getBoundingClientRect();
          const next = xyToLatLng(target.width / 2, target.height / 2);
          onPick(next.lat, next.lng);
        }}
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: MAP_WIDTH,
          height: MAP_HEIGHT,
          borderRadius: 1,
          border: "1px solid",
          borderColor: "divider",
          background:
            "linear-gradient(180deg, #9dd6ff 0%, #b6e1ff 45%, #cfe8a2 45%, #c6df8e 100%)",
          overflow: "hidden",
          cursor: "crosshair",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(0,0,0,0.08) 28px), repeating-linear-gradient(90deg, transparent, transparent 55px, rgba(0,0,0,0.08) 56px)",
          }}
        />
        {marker && (
          <Box
            sx={{
              position: "absolute",
              left: `${(marker.x / MAP_WIDTH) * 100}%`,
              top: `${(marker.y / MAP_HEIGHT) * 100}%`,
              width: 12,
              height: 12,
              borderRadius: "50%",
              bgcolor: "error.main",
              border: "2px solid #fff",
              transform: "translate(-50%, -50%)",
              boxShadow: 2,
            }}
          />
        )}
      </Box>
      {latitude != null && longitude != null && (
        <Button
          size="small"
          variant="text"
          sx={{ alignSelf: "flex-start" }}
          onClick={() =>
            window.open(
              `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=13/${latitude}/${longitude}`,
              "_blank",
              "noopener,noreferrer"
            )
          }
        >
          Open selected point in OpenStreetMap
        </Button>
      )}
    </Stack>
  );
}
