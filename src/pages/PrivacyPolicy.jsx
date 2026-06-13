export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-sm">E</span>
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">EduExpress International</p>
            <p className="text-xs text-slate-400">Dhaka, Bangladesh</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 md:p-12">

          <h1 className="text-3xl font-black text-slate-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-slate-400 mb-8">Last updated: May 21, 2026</p>

          <div className="prose prose-slate max-w-none space-y-8 text-slate-700 leading-relaxed">

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">1. Introduction</h2>
              <p>
                EduExpress International ("we", "us", or "our") operates a CRM and messaging platform
                to communicate with prospective and current students regarding educational consultancy
                services. This Privacy Policy explains how we collect, use, store, and protect your
                personal information when you interact with us through WhatsApp, Facebook Messenger,
                Instagram Direct, or any other messaging channel connected to our platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">2. Information We Collect</h2>
              <p>We may collect the following types of personal information:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1.5">
                <li><strong>Contact details</strong> — name, phone number, email address, WhatsApp ID, Messenger ID, or Instagram ID</li>
                <li><strong>Message content</strong> — text, images, documents, and other media you send to us through messaging channels</li>
                <li><strong>Inquiry information</strong> — preferred study destination, program of interest, education history, English scores, and other details you voluntarily provide</li>
                <li><strong>Lead data</strong> — information submitted through Meta Lead Ads forms</li>
                <li><strong>Device and usage data</strong> — IP address, browser type, and interaction timestamps (collected automatically)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">3. How We Use Your Information</h2>
              <p>We use your personal information to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1.5">
                <li>Respond to your inquiries and provide educational consultancy services</li>
                <li>Send you information about universities, programs, and visa requirements relevant to your interests</li>
                <li>Schedule appointments and follow-up communications</li>
                <li>Process your application for admission or visa</li>
                <li>Improve our services and internal operations</li>
                <li>Comply with legal and regulatory obligations</li>
                <li>Analyse the effectiveness of our marketing campaigns (via Meta Conversions API)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">4. Meta Platforms & WhatsApp</h2>
              <p>
                We use the <strong>WhatsApp Business Cloud API</strong>, <strong>Facebook Messenger Platform</strong>,
                and <strong>Instagram Messaging API</strong> provided by Meta Platforms, Inc. to communicate with you.
                When you message us through these channels, your messages are processed and stored on our secure servers.
                We also use the <strong>Meta Conversions API (CAPI)</strong> to measure the effectiveness of our
                advertising. This involves sharing limited event data (such as a hashed phone number or email) with Meta.
                We do not sell this data or share it with third parties for their own marketing purposes.
              </p>
              <p className="mt-2">
                Please also review Meta's Privacy Policy at{' '}
                <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer"
                  className="text-blue-600 hover:underline">facebook.com/privacy/policy</a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">5. Data Storage & Security</h2>
              <p>
                Your data is stored on secured servers hosted by Hostinger (Lithuania, EU). We implement
                appropriate technical and organisational measures to protect your personal information
                against unauthorised access, alteration, disclosure, or destruction. Access to your data
                is restricted to authorised EduExpress International staff only.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">6. Data Retention</h2>
              <p>
                We retain your personal data for as long as necessary to fulfil the purposes outlined
                in this policy, or as required by applicable law. Conversation and lead data is
                typically retained for up to <strong>3 years</strong> from last contact. You may
                request deletion of your data at any time (see Section 8).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">7. Sharing Your Information</h2>
              <p>We do <strong>not</strong> sell your personal information. We may share it with:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1.5">
                <li><strong>Service providers</strong> — hosting, communications, and analytics providers who process data on our behalf under strict confidentiality agreements</li>
                <li><strong>Universities and institutions</strong> — only with your explicit consent, when processing your application</li>
                <li><strong>Government authorities</strong> — where required by law (e.g. visa processing)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">8. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1.5">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data ("right to be forgotten")</li>
                <li>Withdraw consent for marketing communications at any time</li>
                <li>Lodge a complaint with the relevant data protection authority</li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, please contact us using the details in Section 10.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">9. Cookies</h2>
              <p>
                Our web-based CRM application uses essential session cookies to maintain login state.
                We do not use third-party advertising or tracking cookies on this platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">10. Contact Us</h2>
              <p>If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us:</p>
              <div className="mt-3 bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5 text-sm">
                <p><strong>EduExpress International</strong></p>
                <p>Dhaka, Bangladesh</p>
                <p>Email: <a href="mailto:info@eduexpressint.com" className="text-blue-600 hover:underline">info@eduexpressint.com</a></p>
                <p>WhatsApp: <a href="https://wa.me/8801XXXXXXXXX" className="text-blue-600 hover:underline">+880 1XXX-XXXXXX</a></p>
                <p>Website: <a href="https://eduexpressint.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">eduexpressint.com</a></p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-3">11. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any
                significant changes by posting the new policy on this page with an updated date.
                Continued use of our messaging channels after changes constitutes acceptance of
                the updated policy.
              </p>
            </section>

          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} EduExpress International. All rights reserved.
        </p>
      </div>
    </div>
  );
}
