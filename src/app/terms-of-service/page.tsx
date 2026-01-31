import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for Satura - Read our terms and conditions for using our video editing and content creation platform.",
};

export default function TermsOfServicePage() {
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
        <h1 className="mb-2 text-4xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mb-8 text-sm text-gray-500">Last updated: January 19, 2026</p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">1. Agreement to Terms</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;you&quot; or &quot;User&quot;) and Satura Inc. (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) governing your access to and use of the saturaai.com website and our video editing, content creation, and automation services (collectively, the &quot;Service&quot;).
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, you may not access or use the Service. We reserve the right to modify these Terms at any time, and such modifications will be effective immediately upon posting. Your continued use of the Service following any modifications indicates your acceptance of the modified Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">2. Description of Service</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Satura provides a cloud-based platform for video editing, content creation, and automation tools. Our Service includes, but is not limited to:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Video editing and processing tools</li>
              <li>Automatic subtitle generation and styling</li>
              <li>Video clipping and transformation features</li>
              <li>Split-screen and overlay effects</li>
              <li>AI-powered content generation tools</li>
              <li>Video downloading and format conversion</li>
              <li>Project management and asset storage</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">3. Account Registration</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              To access certain features of our Service, you must create an account. When registering, you agree to:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
            <p className="mb-4 text-gray-600 leading-relaxed">
              You may register using your email address or through third-party authentication services such as Google. By using third-party authentication, you authorize us to access certain account information from that service as permitted by your privacy settings on that service.
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We reserve the right to suspend or terminate your account if any information provided proves to be inaccurate, false, or in violation of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">4. User Content</h2>
            
            <h3 className="mb-3 text-xl font-medium text-gray-800">4.1 Your Content</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              You retain all ownership rights to the content you upload, create, or process through our Service (&quot;User Content&quot;). By uploading or creating User Content, you grant us a limited, non-exclusive, royalty-free license to use, store, and process your content solely for the purpose of providing and improving our Service.
            </p>

            <h3 className="mb-3 text-xl font-medium text-gray-800">4.2 Content Responsibility</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              You are solely responsible for your User Content and the consequences of uploading or publishing it. You represent and warrant that:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>You own or have the necessary rights to use and authorize us to use your User Content</li>
              <li>Your User Content does not infringe any third-party rights, including intellectual property, privacy, or publicity rights</li>
              <li>Your User Content complies with all applicable laws and regulations</li>
              <li>Your User Content does not contain any viruses, malware, or harmful code</li>
            </ul>

            <h3 className="mb-3 text-xl font-medium text-gray-800">4.3 Prohibited Content</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              You agree not to upload, create, or share content that:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Is illegal, harmful, threatening, abusive, harassing, defamatory, or obscene</li>
              <li>Infringes on copyrights, trademarks, or other intellectual property rights</li>
              <li>Contains child sexual abuse material or exploits minors</li>
              <li>Promotes violence, discrimination, or hatred against individuals or groups</li>
              <li>Contains personal information of others without their consent</li>
              <li>Is fraudulent, deceptive, or misleading</li>
              <li>Violates the privacy or publicity rights of others</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">5. Acceptable Use</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Use the Service in any way that violates applicable laws or regulations</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its systems</li>
              <li>Use automated means (bots, scrapers, etc.) to access the Service without our permission</li>
              <li>Interfere with or disrupt the Service or servers connected to the Service</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Remove, alter, or obscure any proprietary notices on the Service</li>
              <li>Use the Service to send spam or unsolicited communications</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Use the Service to compete with us or for any commercial purpose not permitted by these Terms</li>
              <li>Share your account credentials with others or allow others to use your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">6. Subscription and Payments</h2>
            
            <h3 className="mb-3 text-xl font-medium text-gray-800">6.1 Free and Paid Plans</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We offer both free and paid subscription plans. Free plans may have limitations on features, storage, or usage. Paid plans provide access to additional features and increased limits as described on our pricing page.
            </p>

            <h3 className="mb-3 text-xl font-medium text-gray-800">6.2 Billing</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Paid subscriptions are billed in advance on a monthly or annual basis, depending on the plan you select. By subscribing to a paid plan, you authorize us to charge your payment method for the applicable fees.
            </p>

            <h3 className="mb-3 text-xl font-medium text-gray-800">6.3 Automatic Renewal</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Unless you cancel your subscription before the end of your current billing period, your subscription will automatically renew for the same duration at the then-current price.
            </p>

            <h3 className="mb-3 text-xl font-medium text-gray-800">6.4 Cancellation</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              You may cancel your subscription at any time through your account settings. Upon cancellation, you will continue to have access to paid features until the end of your current billing period. No refunds will be provided for partial months or unused time.
            </p>

            <h3 className="mb-3 text-xl font-medium text-gray-800">6.5 Price Changes</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We reserve the right to modify our pricing at any time. Any price changes will be communicated to you at least 30 days before they take effect and will apply to the next billing cycle following the notice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">7. Intellectual Property</h2>
            
            <h3 className="mb-3 text-xl font-medium text-gray-800">7.1 Our Intellectual Property</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              The Service and its original content (excluding User Content), features, and functionality are and will remain the exclusive property of Satura Inc. and its licensors. The Service is protected by copyright, trademark, and other intellectual property laws. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
            </p>

            <h3 className="mb-3 text-xl font-medium text-gray-800">7.2 License to Use the Service</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal or internal business purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">8. Third-Party Services</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Our Service may contain links to or integrate with third-party websites, services, or content that are not owned or controlled by us. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party services. You acknowledge and agree that we are not responsible or liable for any damage or loss caused by your use of any such third-party services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">9. Disclaimer of Warranties</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, THAT DEFECTS WILL BE CORRECTED, OR THAT THE SERVICE IS FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. WE DO NOT WARRANT OR MAKE ANY REPRESENTATIONS REGARDING THE USE OR THE RESULTS OF THE USE OF THE SERVICE.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">10. Limitation of Liability</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL SATURA INC., ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Your access to or use of or inability to access or use the Service</li>
              <li>Any conduct or content of any third party on the Service</li>
              <li>Any content obtained from the Service</li>
              <li>Unauthorized access, use, or alteration of your transmissions or content</li>
            </ul>
            <p className="mb-4 text-gray-600 leading-relaxed">
              IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS EXCEED THE AMOUNT YOU HAVE PAID US IN THE TWELVE (12) MONTHS PRIOR TO THE CLAIM OR ONE HUNDRED US DOLLARS ($100), WHICHEVER IS GREATER.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">11. Indemnification</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              You agree to defend, indemnify, and hold harmless Satura Inc. and its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys&apos; fees, arising out of or in any way connected with:
            </p>
            <ul className="mb-4 list-disc pl-6 text-gray-600 space-y-2">
              <li>Your access to or use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party rights, including intellectual property rights</li>
              <li>Your User Content</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">12. Termination</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will immediately cease.
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              You may terminate your account at any time by contacting us at support@saturaai.com or through your account settings. Upon termination, we will delete your account and User Content within 30 days, except where we are required to retain certain information for legal purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">13. Governing Law and Dispute Resolution</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.
            </p>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Any dispute arising from or relating to these Terms or the Service shall first be attempted to be resolved through good-faith negotiations. If such negotiations fail, the dispute shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. The arbitration shall take place in Delaware, and the decision of the arbitrator shall be final and binding.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">14. General Provisions</h2>
            
            <h3 className="mb-3 text-xl font-medium text-gray-800">14.1 Entire Agreement</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Satura Inc. regarding the Service and supersede any prior agreements.
            </p>

            <h3 className="mb-3 text-xl font-medium text-gray-800">14.2 Severability</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will remain in full force and effect.
            </p>

            <h3 className="mb-3 text-xl font-medium text-gray-800">14.3 Waiver</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
            </p>

            <h3 className="mb-3 text-xl font-medium text-gray-800">14.4 Assignment</h3>
            <p className="mb-4 text-gray-600 leading-relaxed">
              You may not assign or transfer these Terms or your rights under these Terms without our prior written consent. We may assign our rights and obligations under these Terms without restriction.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">15. Contact Us</h2>
            <p className="mb-4 text-gray-600 leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at:
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
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
