import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/password-flows";
// The token is in the URL: never leak it to other sites through the Referer header.
export const metadata = { title: "Reset password · MoneyMgr", referrer: "no-referrer" };
export default function Page() { return <Suspense><ResetPasswordForm /></Suspense>; }
