import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Refund Policy for Satura - Learn about our refund and cancellation policies.",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <a href="/" className="text-xl font-semibold text-gray-900">
            Satura
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="mb-2 text-4xl font-bold text-gray-900">Refund Policy</h1>
        <p className="mb-8 text-sm text-gray-500">Last updated: January 24, 2026</p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">1. No Refunds</h2>
            <p className="mb-4 text-gray-600 leading-relaxed uppercase font-semibold">
              ALL SALES ARE FINAL.
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Satura Inc. (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) does not offer refunds for any products or services under any circumstances once a transaction has been completed.
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              By making a purchase, you explicitly acknowledge and agree that you have read, understood, and accepted this strict no-refund policy.
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              No exceptions will be made to this no-refund policy, including but not limited to:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Claims of dissatisfaction with the Service</li>
              <li>Accidental purchases</li>
              <li>Changes in personal circumstances</li>
              <li>Failure to use the Service during the subscription period</li>
              <li>Technical issues on your end (internet connection, device compatibility, etc.)</li>
              <li>Misunderstanding of features or pricing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">2. Cancellation Policy</h2>
            
            <h3 className="mb-3 text-xl font-medium text-gray-800">2.1 Eligibility</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              All subscribers may cancel their subscription at any time at their choosing. No reason or approval is required to cancel your subscription.
            </p>

            <h3 className="mb-3 text-xl font-medium text-gray-800">2.2 How to Cancel</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              You can cancel your subscription directly within the product by following these steps:
            </p>
            <ol className="mb-4 list-decimal pl-6 text-gray-600 space-y-2">
              <li>Log in to your Satura account</li>
              <li>Navigate to your Dashboard</li>
              <li>Click on &quot;Settings&quot; or &quot;Account&quot;</li>
              <li>Select &quot;Subscription&quot; or &quot;Billing&quot;</li>
              <li>Click &quot;Cancel Subscription&quot;</li>
              <li>Confirm your cancellation</li>
            </ol>

            <h3 className="mb-3 text-xl font-medium text-gray-800">2.3 Effect of Cancellation</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              When you cancel your subscription:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Your subscription will remain active until the end of your current billing cycle</li>
              <li>You will continue to have full access to all paid features until your subscription expires</li>
              <li>No partial refunds will be issued for unused time remaining in your billing period</li>
              <li>Your account will automatically revert to a free plan (if available) once your subscription ends</li>
              <li>You will not be charged for any future billing periods after cancellation</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">3. Subscription Renewal</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              All subscriptions automatically renew at the end of each billing period unless cancelled before the renewal date. It is your responsibility to cancel your subscription before the renewal date if you do not wish to be charged for the next billing period.
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We recommend setting a reminder for yourself if you wish to cancel before your next billing date. You can view your next billing date in your account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">4. Free Trials</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              If we offer a free trial period, you will not be charged during the trial. However, if you do not cancel before the trial ends, your subscription will automatically convert to a paid subscription and you will be charged according to the plan you selected. No refunds will be issued for charges incurred after a free trial converts to a paid subscription.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">5. Chargebacks and Disputes</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              If you initiate a chargeback or payment dispute with your bank or payment provider instead of contacting us directly, we reserve the right to:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Immediately suspend or terminate your account</li>
              <li>Pursue collection of any amounts owed</li>
              <li>Report the incident to fraud prevention services</li>
              <li>Take legal action if necessary</li>
            </ul>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We encourage you to contact us directly at support@saturaai.com before initiating any payment disputes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">6. Modifications to This Policy</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We reserve the right to modify this Refund Policy at any time. Any changes will be effective immediately upon posting to our website. Your continued use of the Service following any changes indicates your acceptance of the modified policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">7. Contact Us</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              If you have any questions about this Refund Policy, please contact us at:
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
              <p className="mb-2 text-gray-700"><strong>Satura Inc.</strong></p>
              <p className="mb-2 text-gray-600">Email: support@saturaai.com</p>
              <p className="text-gray-600">Website: saturaai.com</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-500">© 2026 Satura Inc. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="/privacy-policy" className="text-sm text-gray-600 hover:text-gray-900">Privacy Policy</a>
              <a href="/terms-of-service" className="text-sm text-gray-600 hover:text-gray-900">Terms of Service</a>
              <a href="/refund-policy" className="text-sm text-gray-600 hover:text-gray-900">Refund Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
