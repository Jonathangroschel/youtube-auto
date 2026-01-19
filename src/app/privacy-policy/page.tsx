import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Satura",
  description: "Privacy Policy for Satura - Learn how we collect, use, and protect your personal information.",
};

export default function PrivacyPolicyPage() {
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
        <h1 className="mb-2 text-4xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mb-8 text-sm text-gray-500">Last updated: January 19, 2026</p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">1. Introduction</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Welcome to Satura (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website located at saturaai.com and our video editing and content creation services (collectively, the &quot;Service&quot;).
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Please read this Privacy Policy carefully. By accessing or using our Service, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree with the terms of this Privacy Policy, please do not access or use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">2. Information We Collect</h2>
            
            <h3 className="mb-3 text-xl font-medium text-gray-800">2.1 Information You Provide to Us</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We collect information you provide directly to us when you:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Create an account (email address, name, password)</li>
              <li>Sign in using Google OAuth (name, email address, profile picture)</li>
              <li>Upload content to our platform (videos, images, audio files)</li>
              <li>Contact our support team</li>
              <li>Subscribe to our newsletter or marketing communications</li>
              <li>Make a purchase or subscribe to a paid plan (payment information processed by our payment provider)</li>
            </ul>

            <h3 className="mb-3 text-xl font-medium text-gray-800">2.2 Information Collected Automatically</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              When you access or use our Service, we automatically collect certain information, including:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Device Information:</strong> Device type, operating system, unique device identifiers, browser type, and browser language</li>
              <li><strong>Log Information:</strong> Access times, pages viewed, IP address, and the page you visited before navigating to our Service</li>
              <li><strong>Usage Information:</strong> Information about how you use our Service, including features accessed, actions taken, and time spent on pages</li>
              <li><strong>Cookies and Similar Technologies:</strong> We use cookies, pixels, and similar technologies to collect information about your browsing activities</li>
            </ul>

            <h3 className="mb-3 text-xl font-medium text-gray-800">2.3 Information from Third-Party Services</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              If you choose to sign in using Google, we receive your name, email address, and profile picture from Google. We only request the minimum permissions necessary to authenticate your account. We do not access your Google Drive, Gmail, or other Google services without your explicit consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">3. How We Use Your Information</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We use the information we collect for the following purposes:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Provide and Maintain the Service:</strong> To operate, maintain, and improve our video editing and content creation tools</li>
              <li><strong>Account Management:</strong> To create and manage your account, authenticate your identity, and provide customer support</li>
              <li><strong>Process Transactions:</strong> To process payments, send transaction confirmations, and manage subscriptions</li>
              <li><strong>Communicate with You:</strong> To send you technical notices, updates, security alerts, and support messages</li>
              <li><strong>Marketing:</strong> To send promotional communications (with your consent) about new features, products, and services</li>
              <li><strong>Analytics:</strong> To analyze usage patterns and trends to improve our Service and user experience</li>
              <li><strong>Security:</strong> To detect, prevent, and address technical issues, fraud, and illegal activities</li>
              <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">4. How We Share Your Information</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Service Providers:</strong> We share information with third-party vendors who perform services on our behalf, such as payment processing, data analysis, email delivery, hosting, and customer service</li>
              <li><strong>Business Transfers:</strong> If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law or in response to valid requests by public authorities</li>
              <li><strong>Protection of Rights:</strong> We may disclose information to protect our rights, privacy, safety, or property, or that of our users or the public</li>
              <li><strong>With Your Consent:</strong> We may share information for any other purpose with your explicit consent</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">5. Data Retention</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide you with our Service. We will also retain and use your information as necessary to comply with legal obligations, resolve disputes, and enforce our agreements.
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              When you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain certain information for legal or legitimate business purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">6. Data Security</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Encryption of data in transit using TLS/SSL</li>
              <li>Encryption of sensitive data at rest</li>
              <li>Regular security assessments and audits</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Secure data backup and recovery procedures</li>
            </ul>
            <p className="mb-4 text-gray-600 leading-relaxed">
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your personal information, we cannot guarantee its absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">7. Your Rights and Choices</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Depending on your location, you may have the following rights regarding your personal information:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Access:</strong> You can request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> You can request that we correct inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> You can request that we delete your personal information</li>
              <li><strong>Portability:</strong> You can request a copy of your data in a structured, machine-readable format</li>
              <li><strong>Objection:</strong> You can object to the processing of your personal information in certain circumstances</li>
              <li><strong>Withdraw Consent:</strong> Where we rely on consent, you can withdraw it at any time</li>
            </ul>
            <p className="mb-4 text-gray-600 leading-relaxed">
              To exercise any of these rights, please contact us at ytautomations@proton.me. We will respond to your request within 30 days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">8. Cookies and Tracking Technologies</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We use cookies and similar tracking technologies to collect and track information about your browsing activities. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Types of cookies we use:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li><strong>Essential Cookies:</strong> Required for the operation of our Service</li>
              <li><strong>Analytical Cookies:</strong> Help us understand how visitors interact with our Service</li>
              <li><strong>Functional Cookies:</strong> Enable enhanced functionality and personalization</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">9. International Data Transfers</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that are different from the laws of your country. We take appropriate safeguards to ensure that your personal information remains protected in accordance with this Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">10. Children&apos;s Privacy</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Our Service is not directed to children under the age of 13, and we do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will take steps to delete that information as soon as possible. If you believe we have collected information from a child under 13, please contact us at ytautomations@proton.me.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">11. Changes to This Privacy Policy</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">12. Contact Us</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
              <p className="mb-2 text-gray-700"><strong>Satura</strong></p>
              <p className="mb-2 text-gray-600">Email: ytautomations@proton.me</p>
              <p className="text-gray-600">Website: saturaai.com</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-500">© 2026 Satura. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="/privacy-policy" className="text-sm text-gray-600 hover:text-gray-900">Privacy Policy</a>
              <a href="/terms-of-service" className="text-sm text-gray-600 hover:text-gray-900">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
