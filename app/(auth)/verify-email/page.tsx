import { Suspense } from "react";
import { VerifyEmail } from "@/components/password-flows";
export const metadata = { title: "Confirm email · MoneyMgr", referrer: "no-referrer" };
export default function Page() { return <Suspense><VerifyEmail /></Suspense>; }
