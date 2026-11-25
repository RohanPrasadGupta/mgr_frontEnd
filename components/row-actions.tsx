"use client";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

/** Always-visible edit/delete icon buttons for a list row (no hidden "click the row" discovery needed). */
export function RowActions({ label, onEdit, onDelete, disabled }: { label: string; onEdit?: () => void; onDelete?: () => void; disabled?: boolean }) {
  return (
    <span className="flex shrink-0 items-center">
      {onEdit && <Tooltip title="Edit"><span><IconButton size="small" aria-label={`Edit ${label}`} onClick={onEdit} disabled={disabled} sx={{ color: "var(--muted)", "&:hover": { color: "var(--primary)" } }}><EditOutlined fontSize="small" /></IconButton></span></Tooltip>}
      {onDelete && <Tooltip title="Delete"><span><IconButton size="small" aria-label={`Delete ${label}`} onClick={onDelete} disabled={disabled} sx={{ color: "var(--muted)", "&:hover": { color: "var(--expense)" } }}><DeleteOutlined fontSize="small" /></IconButton></span></Tooltip>}
    </span>
  );
}
