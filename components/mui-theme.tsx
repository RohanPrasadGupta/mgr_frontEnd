"use client";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";

/**
 * MUI is themed from the same CSS variables as Tailwind (globals.css), so light/dark/system switching
 * needs no JS: surfaces and text point at var(--…) and follow `data-theme` / prefers-color-scheme.
 * Only palette *main* colours must be concrete (MUI derives light/dark shades from them).
 */
const font = "var(--font-geist-sans), system-ui, sans-serif";
const theme = createTheme({
  palette: { primary: { main: "#9333ea" }, error: { main: "#dc2626" }, success: { main: "#15803d" }, warning: { main: "#d97706" }, info: { main: "#0891b2" } },
  shape: { borderRadius: 12 },
  typography: { fontFamily: font, button: { textTransform: "none", fontWeight: 600 } },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundColor: "var(--card)", color: "var(--fg)", backgroundImage: "none", border: "1px solid var(--border)" } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,.45)" } } },
    MuiDialogContentText: { styleOverrides: { root: { color: "var(--muted)" } } },
    MuiBackdrop: { styleOverrides: { root: { backgroundColor: "rgba(4, 7, 24, 0.62)" } } },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          "&.MuiButton-containedPrimary": { backgroundColor: "var(--primary)", color: "var(--primary-fg)", "&:hover": { backgroundColor: "var(--primary)", opacity: 0.9 } },
          "&.MuiButton-containedError": { backgroundColor: "var(--expense)", color: "#fff", "&:hover": { backgroundColor: "var(--expense)", opacity: 0.9 } },
          "&.MuiButton-textPrimary": { color: "var(--fg)" },
        },
      },
    },
    MuiAlert: { styleOverrides: { root: { alignItems: "center", fontWeight: 500, color: "#fff", "& .MuiAlert-icon": { color: "#fff" }, "&.MuiAlert-filledSuccess": { backgroundColor: "#15803d" }, "&.MuiAlert-filledError": { backgroundColor: "#dc2626" }, "&.MuiAlert-filledInfo": { backgroundColor: "#0e7490" } } } },
    MuiSpeedDial: { styleOverrides: { fab: { backgroundColor: "var(--primary)", color: "var(--primary-fg)", "&:hover": { backgroundColor: "var(--primary)", opacity: 0.92 } } } },
    MuiSpeedDialAction: { styleOverrides: { fab: { backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border)", "&:hover": { backgroundColor: "var(--card)" } }, staticTooltipLabel: { backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border)", whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(0,0,0,.35)" } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: "var(--card)", color: "var(--fg)", border: "1px solid var(--border)", fontSize: 12 }, arrow: { color: "var(--card)" } } },
    MuiDrawer: { styleOverrides: { paper: { backgroundColor: "var(--card)", color: "var(--fg)", borderRadius: 0 } } },
  },
});

export const MuiTheme = ({ children }: { children: ReactNode }) => <ThemeProvider theme={theme} defaultMode="light">{children}</ThemeProvider>;
