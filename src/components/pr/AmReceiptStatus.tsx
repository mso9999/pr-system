import { useEffect, useState } from "react";
import { doc, onSnapshot, getFirestore } from "firebase/firestore";
import {
  Alert,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { app } from "@/config/firebase";

export default function AmReceiptStatus({ prId }: { prId: string }) {
  const [policy, setPolicy] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(
    () =>
      onSnapshot(
        doc(getFirestore(app), "prReceiptOrders", prId),
        (s) => {
          setPolicy(s.data() || null);
          setError("");
        },
        () =>
          setError(
            "AM receipt status could not be loaded. Closeout must wait for verified evidence.",
          ),
      ),
    [prId],
  );
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!policy) return null;
  const pending = policy.lines.some((l: any) => l.received !== l.ordered);
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6">
        AM recording required before closeout
      </Typography>
      <Alert severity={policy.exception || pending ? "warning" : "success"}>
        {policy.exception ||
          (pending
            ? "AM must record the remaining accepted goods before this order can close. Delivery photos or an override cannot waive this requirement."
            : "All approved quantities are recorded. Final closeout rechecks the current order revision.")}
      </Alert>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Line</TableCell>
              <TableCell>Recorded / ordered</TableCell>
              <TableCell>Destination</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policy.lines.map((l: any) => (
              <TableRow key={l.lineId}>
                <TableCell>{l.description}</TableCell>
                <TableCell>
                  {l.received} / {l.ordered} {l.unit}
                </TableCell>
                <TableCell>{l.locationId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Button
        href={`https://am.1pwrafrica.com/assets/order-receipt.php?pr=${encodeURIComponent(prId)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open AM receipt screen
      </Button>
    </Box>
  );
}
