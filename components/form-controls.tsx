"use client";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import MuiSelect from "@mui/material/Select";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs, { type Dayjs } from "dayjs";
import { Children, Fragment, createContext, isValidElement, useContext, useRef, useState, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes } from "react";

/** Set by <Field>: the control inside uses `id` (for the label's htmlFor) or `labelId` (aria-labelledby). */
export const FieldCtx = createContext<{ id: string; labelId: string; hintId?: string } | null>(null);

/** What a <Select> lists: a choice, or a group heading ("Your currencies"). */
export type Choice = { value: string; label: ReactNode; disabled?: boolean } | { group: string };

/** Reads the <option>/<optgroup> children the forms already use (through fragments and arrays). */
function choicesOf(children: ReactNode, out: Choice[] = []): Choice[] {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const el = c as ReactElement<{ value?: unknown; label?: string; disabled?: boolean; children?: ReactNode }>;
    if (el.type === "option") out.push({ value: String(el.props.value ?? textOf(el.props.children)), label: el.props.children, disabled: el.props.disabled });
    else if (el.type === "optgroup") { out.push({ group: String(el.props.label ?? "") }); choicesOf(el.props.children, out); }
    else if (el.type === Fragment) choicesOf(el.props.children, out);
  });
  return out;
}
const textOf = (n: ReactNode): string => (typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(textOf).join("") : "");

/** The change the forms read: `e.target.value` (and `name`), same as a native <select>/<input>. */
export type ValueChange = { target: { value: string; name?: string } };
export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "defaultValue"> & {
  value?: string; defaultValue?: string; onChange?: (e: ValueChange) => void; options?: Choice[];
};

/**
 * Where a menu or calendar opens. Forms live in a native <dialog> (the browser's top layer), above anything portalled
 * to <body>, so inside one the pop-up is mounted in that dialog instead.
 */
const layerOf = (el: Element | null) => (el?.closest("dialog[open]") as HTMLElement | null) ?? document.body;

/**
 * Themed drop-down (MUI) with the native <select> API the app was written against: <option>/<optgroup> children or
 * `options`, `name` posts in FormData, `value`/`defaultValue`, `required`, `onChange(e => e.target.value)`.
 */
export function Select({ children, options, value, defaultValue, onChange, name, required, disabled, className, title, id, autoFocus, "aria-label": ariaLabel }: SelectProps) {
  const ctx = useContext(FieldCtx);
  const root = useRef<HTMLDivElement>(null);
  const list = options ?? choicesOf(children);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = controlled ? value : inner;
  // a value not (yet) in the list (still loading, or archived) is shown as itself rather than blank
  const known = list.some((c) => "value" in c && c.value === current);
  const items = known || current === "" ? list : [...list, { value: current, label: current }];
  return (
    <MuiSelect
      value={current}
      onChange={(e) => { const v = String(e.target.value); if (!controlled) setInner(v); onChange?.({ target: { value: v, name } }); }}
      name={name} required={required} disabled={disabled} displayEmpty autoFocus={autoFocus} fullWidth={!className?.includes("w-auto")} size="small"
      ref={root} className={className} title={title} MenuProps={{ container: () => layerOf(root.current), slotProps: { paper: { sx: { maxHeight: 360, mt: 0.5 } } } }}
      SelectDisplayProps={{ id, "aria-label": ariaLabel, "aria-labelledby": ariaLabel ? undefined : ctx?.labelId, "aria-describedby": ctx?.hintId } as React.HTMLAttributes<HTMLDivElement>}
    >
      {items.map((c, i) => ("group" in c
        ? <ListSubheader key={`g:${c.group}:${i}`}>{c.group}</ListSubheader>
        : <MenuItem key={`v:${c.value}`} value={c.value} disabled={c.disabled}>{c.label}</MenuItem>))}
    </MuiSelect>
  );
}

const ISO = { date: "YYYY-MM-DD", "datetime-local": "YYYY-MM-DDTHH:mm" } as const;

/**
 * Themed date (or date + time) picker in place of <input type="date|datetime-local">. The form still receives the
 * ISO string it did before (`2026-11-27` / `2026-11-27T14:05`), both through `onChange` and a hidden `name` input.
 */
export function DateInput({ type, name, value, defaultValue, onChange, min, max, required, disabled, id, className, autoFocus, "aria-label": ariaLabel }: InputHTMLAttributes<HTMLInputElement> & { type: "date" | "datetime-local" }) {
  const ctx = useContext(FieldCtx);
  const box = useRef<HTMLDivElement>(null);
  const fmt = ISO[type];
  const controlled = value !== undefined;
  const [inner, setInner] = useState(String(defaultValue ?? ""));
  const iso = controlled ? String(value ?? "") : inner;
  const parse = (s: string) => (s ? dayjs(s) : null);
  // what the field shows; a half-typed date stays on screen until it is complete
  const [shown, setShown] = useState<Dayjs | null>(parse(iso));
  const [seen, setSeen] = useState(iso);
  if (iso !== seen) { setSeen(iso); if (!(shown?.isValid() && shown.format(fmt) === iso)) setShown(parse(iso)); }

  const change = (d: Dayjs | null) => {
    setShown(d);
    const v = d?.isValid() ? d.format(fmt) : "";
    if (v === iso) return;
    if (!controlled) setInner(v);
    onChange?.({ target: { value: v, name } } as React.ChangeEvent<HTMLInputElement>);
  };
  const common = {
    value: shown, onChange: change, disabled, autoFocus,
    minDate: min ? dayjs(String(min)) : undefined, maxDate: max ? dayjs(String(max)) : undefined,
    slotProps: {
      textField: {
        id: id ?? ctx?.id, size: "small" as const, fullWidth: true, required, className,
        inputProps: { "aria-label": ariaLabel, "aria-labelledby": ariaLabel ? undefined : ctx?.labelId, "aria-describedby": ctx?.hintId },
      },
      actionBar: { actions: ["clear", "today", "accept"] as ("clear" | "today" | "accept")[] },
      popper: { container: () => layerOf(box.current) },
      dialog: { container: () => layerOf(box.current) },
    },
  };
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div ref={box} className="contents" />
      {type === "datetime-local" ? <DateTimePicker {...common} format="MMM D, YYYY h:mm A" ampm /> : <DatePicker {...common} format="MMM D, YYYY" />}
      {name && <input type="hidden" name={name} value={iso} />}
    </LocalizationProvider>
  );
}
