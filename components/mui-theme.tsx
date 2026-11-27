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
    // dialogs dim the page; a menu's or calendar's click-catcher stays invisible
    MuiBackdrop: { styleOverrides: { root: { "&:not(.MuiBackdrop-invisible)": { backgroundColor: "rgba(4, 7, 24, 0.62)" } } } },
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

    // ── form fields: drop-downs and date pickers look like the app's own inputs ──
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8, backgroundColor: "var(--bg)", color: "var(--fg)", fontSize: 14,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border)" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "var(--muted)" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "var(--primary)", borderWidth: 1, boxShadow: "0 0 0 3px var(--ring)" },
          "&.Mui-disabled": { opacity: 0.6 },
          "&.Mui-disabled .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border)" },
        },
        input: { padding: "8px 12px", height: "auto", minHeight: 22, "&.Mui-disabled": { WebkitTextFillColor: "var(--muted)" } },
      },
    },
    MuiSelect: { styleOverrides: { select: { padding: "8px 32px 8px 12px", minHeight: "22px !important", lineHeight: "22px" }, icon: { color: "var(--muted)" } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 12, boxShadow: "0 16px 40px rgba(0,0,0,.35)" }, list: { paddingTop: 4, paddingBottom: 4 } } },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: 14, minHeight: 36, margin: "1px 6px", borderRadius: 8, color: "var(--fg)",
          "&:hover": { backgroundColor: "color-mix(in srgb, var(--border) 55%, transparent)" },
          "&.Mui-focusVisible": { backgroundColor: "color-mix(in srgb, var(--border) 55%, transparent)" },
          "&.Mui-selected, &.Mui-selected.Mui-focusVisible": { backgroundColor: "color-mix(in srgb, var(--primary) 16%, transparent)", color: "var(--fg)", fontWeight: 600 },
          "&.Mui-selected:hover": { backgroundColor: "color-mix(in srgb, var(--primary) 22%, transparent)" },
        },
      },
    },
    MuiListSubheader: { styleOverrides: { root: { backgroundColor: "var(--card)", color: "var(--muted)", fontSize: 11, fontWeight: 600, lineHeight: "30px", textTransform: "uppercase", letterSpacing: ".04em" } } },
    // the picker parts are typed by @mui/x-date-pickers/themeAugmentation; listed loosely here to keep this file dependency-free
    ...({
      MuiPickersOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8, backgroundColor: "var(--bg)", color: "var(--fg)", fontSize: 14,
            "& .MuiPickersOutlinedInput-notchedOutline": { borderColor: "var(--border)" },
            "&:hover .MuiPickersOutlinedInput-notchedOutline": { borderColor: "var(--muted)" },
            "&.Mui-focused .MuiPickersOutlinedInput-notchedOutline": { borderColor: "var(--primary)", borderWidth: 1, boxShadow: "0 0 0 3px var(--ring)" },
          },
          sectionsContainer: { padding: "8px 12px" },
        },
      },
      MuiPickersLayout: { styleOverrides: { root: { backgroundColor: "var(--card)", color: "var(--fg)" } } },
      MuiPickersCalendarHeader: { styleOverrides: { label: { fontWeight: 600 }, switchViewButton: { color: "var(--muted)" } } },
      MuiPickersArrowSwitcher: { styleOverrides: { button: { color: "var(--muted)" } } },
      MuiDayCalendar: { styleOverrides: { weekDayLabel: { color: "var(--muted)" } } },
      MuiPickerDay: {
        styleOverrides: {
          root: {
            color: "var(--fg)", fontSize: 13, backgroundColor: "transparent",
            "&:hover": { backgroundColor: "color-mix(in srgb, var(--border) 70%, transparent)" },
            "&.Mui-selected, &.MuiPickerDay-selected, &.Mui-selected:hover, &.Mui-selected:focus": { backgroundColor: "var(--primary)", color: "var(--primary-fg)", fontWeight: 600 },
            "&.MuiPickerDay-today:not(.Mui-selected):not(.MuiPickerDay-selected)": { border: "1px solid var(--primary)" },
            "&.Mui-disabled:not(.Mui-selected), &.MuiPickerDay-disabled": { color: "var(--muted)", opacity: 0.4 },
            "&.MuiPickerDay-dayOutsideMonth": { color: "var(--muted)" },
          },
        },
      },
      MuiPickerPopper: { styleOverrides: { paper: { borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,.35)" } } },
      MuiYearCalendar: { styleOverrides: { button: { color: "var(--fg)", "&.Mui-selected, &.MuiYearCalendar-selected": { backgroundColor: "var(--primary)", color: "var(--primary-fg)" } } } },
      MuiMonthCalendar: { styleOverrides: { button: { color: "var(--fg)", "&.Mui-selected, &.MuiMonthCalendar-selected": { backgroundColor: "var(--primary)", color: "var(--primary-fg)" } } } },
      MuiMultiSectionDigitalClockSection: { styleOverrides: { item: { color: "var(--fg)", "&.Mui-selected": { backgroundColor: "var(--primary)", color: "var(--primary-fg)" } } } },
      // the header the phone-size picker shows ("SELECT DATE & TIME · Nov 27 · 11:56 AM") and its date/time tabs
      MuiPickersToolbar: { styleOverrides: { root: { color: "var(--muted)", "& .MuiPickersToolbar-title": { color: "var(--muted)" } } } },
      MuiDateTimePickerTabs: { styleOverrides: { root: { backgroundColor: "var(--card)", "& .MuiTab-root": { color: "var(--muted)" }, "& .MuiTab-root.Mui-selected": { color: "var(--primary)" }, "& .MuiTabs-indicator": { backgroundColor: "var(--primary)" } } } },
      MuiDateTimePickerToolbar: { styleOverrides: { root: { color: "var(--fg)" }, separator: { color: "var(--muted)" } } },
      MuiPickersToolbarText: { styleOverrides: { root: { color: "var(--muted)", "&[data-selected], &.Mui-selected": { color: "var(--fg)" } } } },
      MuiPickersToolbarButton: { styleOverrides: { root: { color: "var(--fg)" } } },
      MuiClock: { styleOverrides: { clock: { backgroundColor: "var(--bg)" }, pin: { backgroundColor: "var(--primary)" } } },
      MuiClockNumber: { styleOverrides: { root: { color: "var(--fg)", "&.Mui-selected": { color: "var(--primary-fg)" } } } },
      MuiClockPointer: { styleOverrides: { root: { backgroundColor: "var(--primary)" }, thumb: { backgroundColor: "var(--primary-fg)", borderColor: "var(--primary)" } } },
      MuiDialogActions: { styleOverrides: { root: { "& .MuiButton-root": { color: "var(--primary)" } } } },
      MuiInputAdornment: { styleOverrides: { root: { color: "var(--muted)", "& .MuiIconButton-root": { color: "var(--muted)" } } } },
      MuiDivider: { styleOverrides: { root: { borderColor: "var(--border)" } } },
    } as Record<string, unknown>),
  },
});

export const MuiTheme = ({ children }: { children: ReactNode }) => <ThemeProvider theme={theme} defaultMode="light">{children}</ThemeProvider>;
