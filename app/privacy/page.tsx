export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050810] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
          Privacy Policy
        </h1>
        
        <div className="space-y-6 text-slate-300">
          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">1. Introduction</h2>
            <p className="mb-3">
              Multiverse Mouse ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI image generation service.
            </p>
            <p className="text-sm text-yellow-400">
              By using our service, you consent to the data practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">2. Information We Collect</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-white mb-1">Account Information</h3>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li>Email address (required for account creation)</li>
                  <li>Name (optional, for personalization)</li>
                  <li>Password (encrypted and hashed)</li>
                  <li>Account creation date and last login timestamp</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Usage Data</h3>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li>Text prompts submitted for image generation</li>
                  <li>Reference images uploaded (if any)</li>
                  <li>Model selection (NanoBanana Cluster, Pro, or SeeDream)</li>
                  <li>Quality and aspect ratio settings</li>
                  <li>Generation timestamps and ticket consumption records</li>
                  <li>IP address and browser information (for security)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Payment Information</h3>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li>PayPal transaction IDs and payment amounts</li>
                  <li>We do NOT store credit card numbers or banking details</li>
                  <li>All payment processing is handled securely by PayPal</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Generated Content</h3>
                <ul className="list-disc ml-6 space-y-1 text-sm">
                  <li>AI-generated images (stored for 30 days)</li>
                  <li>Image metadata (creation date, model used, user ID)</li>
                  <li>Download history and view counts</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-blue-500/10 border border-blue-500/30 p-6 rounded-xl">
            <h2 className="text-2xl font-bold text-blue-400 mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We use collected information for the following purposes:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <div>
                  <p className="font-bold text-white">Service Delivery</p>
                  <p className="text-sm">Processing your prompts through AI models to generate images</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <div>
                  <p className="font-bold text-white">Account Management</p>
                  <p className="text-sm">Authenticating users, managing ticket balances, and tracking usage history</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <div>
                  <p className="font-bold text-white">Billing & Support</p>
                  <p className="text-sm">Processing payments, preventing fraud, and responding to support requests</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <div>
                  <p className="font-bold text-white">Safety & Compliance</p>
                  <p className="text-sm">Detecting prohibited content, preventing abuse, and complying with legal obligations</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <div>
                  <p className="font-bold text-white">Service Improvement</p>
                  <p className="text-sm">Analyzing anonymized usage patterns to optimize performance and user experience</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">4. Third-Party Service Providers</h2>
            <p className="mb-3">We share your data with the following third parties only to provide our service:</p>
            <div className="space-y-3">
              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🤖</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white mb-1">FAL.ai (AI Infrastructure Provider)</h3>
                    <p className="text-sm mb-2"><strong className="text-cyan-400">What they receive:</strong> Your text prompts, reference images (if uploaded), and generation parameters</p>
                    <p className="text-sm mb-2"><strong className="text-cyan-400">Purpose:</strong> Processing AI image generation through their models (Google Gemini, ByteDance SeeDream)</p>
                    <p className="text-sm"><strong className="text-cyan-400">Privacy policy:</strong> <a href="https://fal.ai/privacy" className="text-cyan-400 hover:underline" target="_blank" rel="noopener">fal.ai/privacy</a></p>
                    <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-sm">
                      <p className="text-green-400 font-bold">✓ FAL.ai Enterprise API Guarantee:</p>
                      <p>Your prompts and images are <strong className="text-white">NOT used to train AI models</strong> under their paid enterprise terms.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">💳</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white mb-1">PayPal (Payment Processor)</h3>
                    <p className="text-sm mb-2"><strong className="text-cyan-400">What they receive:</strong> Your email, payment amount, and transaction details</p>
                    <p className="text-sm mb-2"><strong className="text-cyan-400">Purpose:</strong> Secure payment processing for ticket purchases</p>
                    <p className="text-sm mb-2"><strong className="text-cyan-400">What we DON'T see:</strong> Your credit card numbers, bank account details, or billing addresses</p>
                    <p className="text-sm"><strong className="text-cyan-400">Privacy policy:</strong> <a href="https://www.paypal.com/privacy" className="text-cyan-400 hover:underline" target="_blank" rel="noopener">paypal.com/privacy</a></p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">☁️</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white mb-1">Vercel (Hosting & Storage)</h3>
                    <p className="text-sm mb-2"><strong className="text-cyan-400">What they store:</strong> Generated images, user data, and application files</p>
                    <p className="text-sm mb-2"><strong className="text-cyan-400">Purpose:</strong> Website hosting and temporary image storage (30 days)</p>
                    <p className="text-sm mb-2"><strong className="text-cyan-400">Security:</strong> SOC 2 Type II certified, encrypted at rest and in transit</p>
                    <p className="text-sm"><strong className="text-cyan-400">Privacy policy:</strong> <a href="https://vercel.com/legal/privacy-policy" className="text-cyan-400 hover:underline" target="_blank" rel="noopener">vercel.com/legal/privacy-policy</a></p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🗄️</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white mb-1">PostgreSQL Database (Neon/Supabase)</h3>
                    <p className="text-sm mb-2"><strong className="text-cyan-400">What they store:</strong> User accounts, ticket balances, generation history, and metadata</p>
                    <p className="text-sm mb-2"><strong className="text-cyan-400">Purpose:</strong> Persistent data storage and user authentication</p>
                    <p className="text-sm"><strong className="text-cyan-400">Security:</strong> Encrypted connections, regular backups, access control</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
              <p className="text-sm font-bold text-red-400 mb-1">⚠️ Important Note on AI Model Data Usage</p>
              <p className="text-sm">
                While FAL.ai does not use your data for training under their enterprise terms, the <strong className="text-white">underlying AI model providers (Google, ByteDance)</strong> may have their own data policies. We use paid/enterprise tiers to minimize data retention, but you should review their policies for complete transparency.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">5. Data Retention & Automatic Deletion</h2>
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg mb-3">
              <p className="font-bold text-yellow-400 mb-2">⏱️ Automatic Data Deletion Timeline</p>
              <ul className="list-disc ml-6 space-y-1 text-sm">
                <li><strong className="text-white">Generated Images:</strong> Automatically deleted after 30 days</li>
                <li><strong className="text-white">Prompts & Metadata:</strong> Retained for 90 days for support purposes, then deleted</li>
                <li><strong className="text-white">Account Data:</strong> Retained until account deletion request</li>
                <li><strong className="text-white">Payment Records:</strong> Retained for 7 years (legal requirement for tax purposes)</li>
              </ul>
            </div>
            <p className="text-sm">
              This policy ensures your creative work isn't stored indefinitely while maintaining records necessary for legal compliance and customer support.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">6. Your Privacy Rights</h2>
            <div className="space-y-3">
              <div className="p-3 bg-slate-900/50 rounded-lg">
                <h3 className="font-bold text-white mb-1">🔍 Right to Access</h3>
                <p className="text-sm">Request a copy of all personal data we have stored about you</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg">
                <h3 className="font-bold text-white mb-1">✏️ Right to Correction</h3>
                <p className="text-sm">Update or correct inaccurate information in your account</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg">
                <h3 className="font-bold text-white mb-1">🗑️ Right to Deletion</h3>
                <p className="text-sm">Request complete deletion of your account and all associated data</p>
                <p className="text-xs text-slate-400 mt-1">Note: Payment records may be retained for legal/tax compliance</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg">
                <h3 className="font-bold text-white mb-1">📦 Right to Data Portability</h3>
                <p className="text-sm">Export your generation history and prompts in machine-readable format</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg">
                <h3 className="font-bold text-white mb-1">⛔ Right to Opt-Out</h3>
                <p className="text-sm">Opt-out of marketing emails (service emails cannot be disabled)</p>
              </div>
            </div>
            <p className="mt-3 text-sm">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:DirtySecretAi@gmail.com" className="text-cyan-400 hover:underline">
                DirtySecretAi@gmail.com
              </a>
              {' '}with "Privacy Request" in the subject line. We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">7. Data Security Measures</h2>
            <p className="mb-3">We implement industry-standard security practices to protect your data:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="font-bold text-cyan-400 text-sm mb-1">🔐 Encryption</p>
                <p className="text-xs">TLS 1.3 for data in transit, AES-256 for data at rest</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="font-bold text-cyan-400 text-sm mb-1">🔑 Password Security</p>
                <p className="text-xs">Bcrypt hashing with salt, never stored in plaintext</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="font-bold text-cyan-400 text-sm mb-1">🛡️ Access Control</p>
                <p className="text-xs">Role-based permissions, minimal data access principle</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="font-bold text-cyan-400 text-sm mb-1">📊 Monitoring</p>
                <p className="text-xs">24/7 intrusion detection and security logging</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="font-bold text-cyan-400 text-sm mb-1">🔄 Regular Backups</p>
                <p className="text-xs">Daily encrypted backups with 30-day retention</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="font-bold text-cyan-400 text-sm mb-1">🔬 Security Audits</p>
                <p className="text-xs">Regular vulnerability scans and dependency updates</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-yellow-400">
              ⚠️ No security system is 100% impenetrable. While we implement best practices, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">8. Cookies & Tracking Technologies</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-white mb-1">Essential Cookies</h3>
                <p className="text-sm mb-1">Required for the service to function:</p>
                <ul className="list-disc ml-6 text-xs space-y-1">
                  <li>Session authentication tokens</li>
                  <li>CSRF protection</li>
                  <li>User preferences (theme, language)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-white mb-1">Analytics Cookies (Optional)</h3>
                <p className="text-sm mb-1">Used to improve our service:</p>
                <ul className="list-disc ml-6 text-xs space-y-1">
                  <li>Page views and navigation patterns</li>
                  <li>Feature usage statistics</li>
                  <li>Error tracking and performance metrics</li>
                </ul>
                <p className="text-xs text-slate-400 mt-1">You can disable analytics cookies in your browser settings without affecting service functionality.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">9. Children's Privacy (COPPA Compliance)</h2>
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
              <p className="font-bold text-red-400 mb-2">🔞 Age Restriction: 18+</p>
              <p className="text-sm mb-2">
                Our service is <strong className="text-white">not intended for users under 18 years of age</strong>. We do not knowingly collect personal information from minors.
              </p>
              <p className="text-sm">
                If we discover that a user is under 18, we will immediately delete their account and all associated data. If you believe a minor has created an account, please contact us immediately at{' '}
                <a href="mailto:DirtySecretAi@gmail.com" className="text-cyan-400 hover:underline">
                  DirtySecretAi@gmail.com
                </a>
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">10. International Data Transfers</h2>
            <p className="mb-2">
              Our service is operated from the United States. Your data may be transferred to and processed in the United States or other countries where our service providers operate.
            </p>
            <p className="text-sm">
              By using our service, you consent to the transfer of your information to countries outside your country of residence, which may have different data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">11. Data Breach Notification</h2>
            <p className="mb-2">
              In the event of a data breach that affects your personal information, we will:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-sm">
              <li>Notify affected users within 72 hours of discovery</li>
              <li>Provide details about what data was compromised</li>
              <li>Outline steps we're taking to address the breach</li>
              <li>Offer guidance on protecting your account</li>
              <li>Comply with all legal notification requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">12. California Privacy Rights (CCPA)</h2>
            <p className="mb-2 text-sm">
              If you are a California resident, you have additional rights under the California Consumer Privacy Act:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-sm">
              <li>Right to know what personal information is collected, used, shared, or sold</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of the sale of personal information (we do NOT sell your data)</li>
              <li>Right to non-discrimination for exercising your privacy rights</li>
            </ul>
            <p className="mt-2 text-xs text-slate-400">
              We do not sell personal information and have not sold any personal information in the past 12 months.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">13. European Privacy Rights (GDPR)</h2>
            <p className="mb-2 text-sm">
              If you are a European Union resident, you have rights under the General Data Protection Regulation:
            </p>
            <ul className="list-disc ml-6 space-y-1 text-sm">
              <li>Right to access, rectification, erasure, and data portability</li>
              <li>Right to restrict processing and object to processing</li>
              <li>Right to withdraw consent at any time</li>
              <li>Right to lodge a complaint with your local supervisory authority</li>
            </ul>
            <p className="mt-2 text-sm">
              Legal basis for processing: Contractual necessity (to provide the service) and legitimate interest (to improve and secure our platform).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">14. Changes to This Privacy Policy</h2>
            <p className="mb-2">
              We may update this Privacy Policy periodically to reflect changes in our practices or legal requirements.
            </p>
            <ul className="list-disc ml-6 space-y-1 text-sm">
              <li>Material changes will be communicated via email with 30 days' notice</li>
              <li>The "Last updated" date will be revised</li>
              <li>Continued use after changes constitutes acceptance</li>
              <li>Previous versions are available upon request</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">15. Contact Us</h2>
            <p className="mb-2">
              For privacy questions, concerns, or to exercise your rights, contact us at:
            </p>
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
              <p className="font-bold text-white">Email:</p>
              <p className="text-cyan-400 mb-3">
                <a href="mailto:DirtySecretAi@gmail.com" className="hover:underline">
                  DirtySecretAi@gmail.com
                </a>
              </p>
              <p className="text-sm text-slate-400">
                Response time: We aim to respond to all privacy inquiries within 30 days.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 p-6 rounded-xl border-2 border-green-500/30 bg-green-500/5">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🛡️</div>
            <div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Our Privacy Commitment</h3>
              <p className="text-slate-300 mb-2">
                We use <strong className="text-white">FAL.ai's enterprise API</strong> which guarantees that your prompts and images are <strong className="text-white">never used to train AI models</strong>.
              </p>
              <p className="text-sm text-slate-400">
                Your creativity is yours. We're just the infrastructure that helps bring it to life.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center border-t border-slate-800 pt-6">
          <p className="text-sm text-slate-500">Last updated: January 22, 2026</p>
          <p className="text-xs text-slate-600 mt-1">Version 2.0</p>
        </div>
      </div>
    </div>
  )
}
