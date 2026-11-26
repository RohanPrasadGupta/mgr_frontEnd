import Link from "next/link";
import { CONTACT_EMAIL, POLICY_UPDATED } from "@/lib/legal";

export const metadata = { title: "Privacy policy · MoneyMgr" };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="pt-4 text-lg font-semibold">{children}</h2>;
const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>;

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
      <p className="text-sm text-muted">Last updated {POLICY_UPDATED}</p>
      <p>
        MoneyMgr is a personal finance tracker for the web, iPhone and Android. This page explains what we store,
        why, who can see it, and how you remove it. In short: your data is used only to run the app for you. We don&apos;t
        sell it, show ads, or use third-party analytics or tracking.
      </p>

      <H>What we store</H>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>Your account:</strong> name, email address, a hash of your password (never the password itself), base currency, time zone and display preferences.</li>
        <li><strong>What you enter:</strong> accounts, transactions, transfers, categories, tags, budgets, recurring rules, goals, debts, notes, investments, prices and trades.</li>
        <li><strong>Receipts you attach:</strong> the image or PDF files and their names.</li>
        <li><strong>Sign-in sessions:</strong> for each signed-in device, the device/browser description (user agent) and when it signed in, so you stay signed in and sessions can be ended.</li>
        <li><strong>Security data:</strong> your IP address is used briefly to limit repeated sign-in attempts; these counters expire automatically within an hour.</li>
        <li><strong>Server logs:</strong> for each request to our server, the time, the address requested, the result, how long it took, your IP address and your account ID — never what you entered. We use them to keep the service secure and fix problems. They are deleted automatically as newer entries replace them and are not included in backups.</li>
      </ul>
      <p>We don&apos;t connect to your bank, read your messages, or collect your location, contacts or device identifiers. The camera and photo library are used only when you choose to attach a receipt.</p>

      <H>Why we use it</H>
      <p>Only to provide the service: to show your finances, calculate totals, budgets and reports, keep you signed in, send account emails (email confirmation and password reset), and protect accounts from abuse. We don&apos;t use your data for advertising or profiling, and we don&apos;t sell or rent it to anyone.</p>

      <H>Where it is kept and who processes it</H>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>Amazon Web Services</strong> hosts the servers and stores the database, receipts and backups, in the Singapore region (ap-southeast-1). Data is encrypted in transit (HTTPS) and the disks and backups are encrypted at rest.</li>
        <li><strong>An email delivery provider</strong> receives your email address and the message when we send you an account email.</li>
        <li>Exchange rates are downloaded from a public rates service; none of your data is sent to it.</li>
      </ul>

      <H>Who can see your data</H>
      <p>
        You. A small number of MoneyMgr administrators can see account-level information (your name, email, sign-up date and
        how many records you have — not amounts) to provide support and keep the service running. Seeing the contents of
        your finances requires an administrator to record a reason, is limited in time, and every access is written to a
        permanent audit log. We disclose data to authorities only when legally required.
      </p>

      <H>How long we keep it</H>
      <p>
        For as long as you have an account. When you delete your account, your data is erased from the live database
        immediately. Copies in encrypted backups are overwritten within 30 days. Audit-log entries about administrator
        actions on your account (for example &ldquo;account deleted&rdquo;) are kept for security, without your financial data.
      </p>

      <H>Your choices and rights</H>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>See and correct</strong> everything you entered, at any time, in the app.</li>
        <li><strong>Export</strong> your transactions as a CSV file (Import / Export).</li>
        <li><strong>Delete your account</strong> and all its data yourself in Settings — see <Link href="/delete-account" className="text-primary underline">how to delete your account</Link>.</li>
        <li><strong>Ask us</strong> anything about your data, or request a copy or deletion, at <Mail />.</li>
      </ul>

      <H>Cookies</H>
      <p>The website uses only the cookies needed to keep you signed in (and remember your theme choice in your browser). No advertising or analytics cookies.</p>

      <H>Children</H>
      <p>MoneyMgr is not directed at children under 13, and we don&apos;t knowingly collect their data. If you believe a child has created an account, contact us and we will delete it.</p>

      <H>Changes</H>
      <p>If this policy changes in a way that matters, we&apos;ll update the date above and tell you in the app before the change applies.</p>

      <H>Contact</H>
      <p>Questions or requests: <Mail />.</p>
    </>
  );
}
