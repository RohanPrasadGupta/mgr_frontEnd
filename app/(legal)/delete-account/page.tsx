import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata = { title: "Delete your account · MoneyMgr" };

export default function DeleteAccountPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Delete your MoneyMgr account</h1>
      <p>You can delete your account and all of its data yourself, at any time, from any of the apps.</p>

      <h2 className="pt-4 text-lg font-semibold">In the app (iPhone or Android)</h2>
      <ol className="list-decimal space-y-1 pl-6">
        <li>Open MoneyMgr and sign in.</li>
        <li>Go to <strong>Settings</strong>.</li>
        <li>Tap <strong>Delete my account…</strong>, enter your password and type <strong>DELETE</strong> to confirm.</li>
      </ol>

      <h2 className="pt-4 text-lg font-semibold">On the website</h2>
      <ol className="list-decimal space-y-1 pl-6">
        <li>Sign in, open <strong>Settings</strong>.</li>
        <li>Click <strong>Delete my account…</strong>, enter your password and type <strong>DELETE</strong> to confirm.</li>
      </ol>

      <h2 className="pt-4 text-lg font-semibold">Can&apos;t sign in?</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20MoneyMgr%20account`} className="text-primary underline">{CONTACT_EMAIL}</a> from
        the email address on the account and ask for it to be deleted. We&apos;ll confirm it&apos;s your account and delete it within 30 days.
      </p>

      <h2 className="pt-4 text-lg font-semibold">What gets deleted</h2>
      <p>
        Everything: your profile, accounts, transactions, categories, tags, budgets, recurring rules, goals, debts, notes,
        investments, receipts and sign-in sessions. It is erased from the live database immediately and can&apos;t be undone.
        Encrypted backup copies are overwritten within 30 days. A record that the account was deleted (without its financial
        data) is kept in our security audit log.
      </p>
    </>
  );
}
