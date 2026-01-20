export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050810] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
          Privacy Policy
        </h1>
        
        <div className="space-y-6 text-slate-300">
          <section className="bg-green-500/10 border border-green-500/30 p-6 rounded-xl">
            <h2 className="text-2xl font-bold text-green-400 mb-3">🛡️ 1. Data Usage & Google AI Integration</h2>
            <p className="mb-3">
              Because we use the <strong className="text-white">Paid Tier of the Google Gemini API</strong>, your privacy is significantly enhanced:
            </p>
            <ul className="list-disc ml-6 space-y-2">
              <li>
                <strong className="text-white">No Model Training:</strong> Google does not use your prompts or generated images to train or improve its AI models when processed through our paid enterprise API.
              </li>
              <li>
                <strong className="text-white">Safety Monitoring:</strong> Automated systems may scan prompts and outputs to detect and block prohibited content (e.g., hate speech or illegal imagery).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">2. Information We Collect</h2>
            <ul className="list-disc ml-6 space-y-2">
              <li><strong className="text-white">Account Data:</strong> Email address and name for authentication</li>
              <li><strong className="text-white">Usage Logs:</strong> We record the number of tickets used and generation timestamps for billing and support</li>
              <li><strong className="text-white">Prompt Content:</strong> We store your prompts for 30 days to allow you to view your generation history</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">3. Third-Party Data Sharing</h2>
            <p className="mb-3">We share specific data with the following partners only to provide the service:</p>
            <div className="space-y-3">
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                <h3 className="font-bold text-white mb-1">Google Cloud / Vertex AI</h3>
                <p className="text-sm">Receives your prompt and any reference images to generate the final output.</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                <h3 className="font-bold text-white mb-1">PayPal</h3>
                <p className="text-sm">Receives your payment details. Multiverse Mouse does not see or store your credit card or bank information.</p>
              </div>
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                <h3 className="font-bold text-white mb-1">Vercel</h3>
                <p className="text-sm">Hosts the website and temporarily stores the generated image files.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">4. Invisible Watermarking (SynthID)</h2>
            <p>
              Images generated through this platform include <strong className="text-white">SynthID metadata</strong>. This technology embeds an invisible watermark into the pixels to track the provenance of AI-generated media, assisting in the responsible use of AI.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">5. Your Rights & Data Deletion</h2>
            <p className="mb-3">You may request the full deletion of your account and all associated data at any time by contacting <a href="mailto:DirtySecretAi@gmail.com" className="text-cyan-400 hover:underline">DirtySecretAi@gmail.com</a>.</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>All images older than 30 days are automatically scrubbed from our systems</li>
              <li>Upon account deletion, all data is permanently removed within 7 business days</li>
              <li>You can export your data at any time before deletion</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">6. Data Security</h2>
            <p className="mb-3">Your data is protected using industry-standard security measures:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Passwords are hashed and never stored in plain text</li>
              <li>All data transmission uses HTTPS encryption</li>
              <li>Images are stored on secure cloud servers with restricted access</li>
              <li>Regular security audits and updates</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">7. Cookies & Analytics</h2>
            <p className="mb-3">We use cookies for:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>Session management and authentication</li>
              <li>Analytics to improve user experience</li>
              <li>Remembering user preferences</li>
            </ul>
            <p className="mt-3 text-sm">You can disable cookies in your browser, but this may affect functionality.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">8. Children's Privacy</h2>
            <p className="font-bold text-yellow-400">
              Our service is not intended for users under 18. We do not knowingly collect information from children. If we become aware that a user is under 18, we will immediately delete their account and all associated data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this policy periodically. Significant changes will be communicated via email with 30 days' notice. Continued use of the service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-cyan-400 mb-3">10. Contact Us</h2>
            <p>
              For privacy concerns, contact us at{' '}
              <a href="mailto:DirtySecretAi@gmail.com" className="text-cyan-400 hover:underline">
                DirtySecretAi@gmail.com
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 p-6 rounded-xl border-2 border-green-500/30 bg-green-500/5">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🛡️</div>
            <div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Privacy Guarantee</h3>
              <p className="text-slate-300">
                Powered by <strong className="text-white">Google Gemini Paid API</strong>. Your prompts and images are <strong className="text-white">never used to train AI models</strong>. Your creativity stays yours.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center border-t border-slate-800 pt-6">
          <p className="text-sm text-slate-500">Last updated: January 20, 2026</p>
        </div>
      </div>
    </div>
  )
}
