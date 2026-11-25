import { pad } from "./money";
/** Today's date in the browser's timezone as YYYY-MM-DD. */
export const todayIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const formatDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
