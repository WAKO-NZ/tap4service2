import { useNavigate } from 'react-router-dom';

export default function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="absolute top-4 right-4 text-yellow-400 font-bold text-2xl">9</div>
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-4xl w-full">
        <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Terms and Conditions</h2>
        <div className="prose prose-lg mx-auto text-gray-700">
          <h1>Tap4Service Terms and Conditions</h1>
          <p><strong>Last Updated: June 01, 2025</strong></p>
          <p>Welcome to <strong>Tap4Service</strong>, a web application operated by Tap4Service Limited (“we,” “us,” “our”) in New Zealand. These Terms and Conditions (“Terms”) govern your use of the Tap4Service web app, including all services, features, and content provided. By accessing or using Tap4Service, you (“User,” “you”) agree to be bound by these Terms. If you do not agree, please do not use the app.</p>

          <h2>1. Acceptance of Terms</h2>
          <ul>
            <li>By registering, logging in, or using Tap4Service, you confirm that you have read, understood, and agree to these Terms and our Privacy Policy.</li>
            <li>You must be at least 18 years old and reside in New Zealand to use Tap4Service.</li>
            <li>We may update these Terms at any time. Changes will be posted on the app, and your continued use constitutes acceptance of the updated Terms.</li>
          </ul>

          <h2>2. Services</h2>
          <ul>
            <li><strong>Tap4Service</strong> connects customers with technicians for repair services. Customers can submit service requests, and technicians can accept and complete jobs.</li>
            <li>Each service callout costs <strong>NZD 99.00</strong>, payable via BNZ Pay (Visa or Mastercard). Payment is pending upon submission, authorized when a technician accepts the job, and captured upon customer confirmation of completion.</li>
            <li>We do not guarantee that a technician can resolve all issues during a callout, as additional materials or replacements may be required.</li>
            <li>Services are provided with reasonable care and skill, as required by the <strong>Consumer Guarantees Act 1993</strong>.</li>
          </ul>

          <h2>3. User Accounts</h2>
          <ul>
            <li><strong>Registration</strong>: You must provide accurate, complete information during registration (name, email, password). You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li><strong>Single User License</strong>: Your account is for personal use and may not be shared. Unauthorized access is prohibited.</li>
            <li><strong>Termination</strong>: We may suspend or terminate your account for violating these Terms, including non-payment or misuse of the app.</li>
          </ul>

          <h2>4. Payment Terms</h2>
          <ul>
            <li><strong>Callout Fee</strong>: NZD 99.00 per service request, clearly disclosed before submission.</li>
            <li><strong>Payment Process</strong>:
              <ul>
                <li>Customers enter card details during request submission (Page 4).</li>
                <li>Payment is authorized when a technician accepts the job (Page 7).</li>
                <li>Payment is captured upon customer confirmation of completion (Page 6).</li>
              </ul>
            </li>
            <li>Payments are processed via BNZ Pay, subject to their terms. We do not store card details beyond what is necessary for processing.</li>
            <li>Refunds are issued only if a technician fails to attend the scheduled callout, per the <strong>Consumer Guarantees Act 1993</strong>.</li>
          </ul>

          <h2>5. User Obligations</h2>
          <ul>
            <li>You agree to:
              <ul>
                <li>Provide accurate information for service requests and payments.</li>
                <li>Use Tap4Service for lawful purposes only.</li>
                <li>Not reproduce, modify, or distribute app content without permission.</li>
              </ul>
            </li>
            <li>You must not:
              <ul>
                <li>Post offensive or unlawful content.</li>
                <li>Attempt to reverse engineer or hack the app.</li>
              </ul>
            </li>
            <li>Customers must confirm job completion promptly to release payment to technicians.</li>
          </ul>

          <h2>6. Intellectual Property</h2>
          <ul>
            <li>All content (e.g., logo, UI, text) is owned by Tap4Service Limited and protected by the <strong>Copyright Act 1994</strong>. You may not copy, modify, or distribute content without written permission.</li>
            <li>Users grant us a non-exclusive, worldwide license to use submitted data (e.g., service descriptions) to operate the app.</li>
          </ul>

          <h2>7. Privacy</h2>
          <ul>
            <li>We collect and use personal information (e.g., name, email, card details) per our Privacy Policy, compliant with the <strong>Privacy Act 2020</strong>.</li>
            <li>You consent to data processing for service delivery, payment processing, and app functionality.</li>
            <li>We do not share personal data with third parties except as required for services (e.g., BNZ Pay) or legal obligations.</li>
          </ul>

          <h2>8. Liability</h2>
          <ul>
            <li>We are not liable for:
              <ul>
                <li>Losses arising from user errors, misuse, or unauthorized access.</li>
                <li>Service interruptions due to technical issues or maintenance.</li>
                <li>Issues beyond our control (e.g., technician performance, third-party payment failures).</li>
              </ul>
            </li>
            <li>Our liability is limited to the callout fee (NZD 99.00) for any claim, per the <strong>Fair Trading Act 1986</strong>.</li>
            <li>We exclude implied warranties to the extent permitted by New Zealand law, except those under the <strong>Consumer Guarantees Act 1993</strong>.</li>
          </ul>

          <h2>9. Dispute Resolution</h2>
          <ul>
            <li>If you have a complaint, contact us at support@tap4service.co.nz. We aim to resolve disputes within 14 days.</li>
            <li>Unresolved disputes may be referred to mediation or arbitration in New Zealand before legal action.</li>
            <li>You agree to comply with the <strong>Consumer Guarantees Act 1993</strong> for service-related disputes.</li>
          </ul>

          <h2>10. Termination</h2>
          <ul>
            <li>You may stop using Tap4Service at any time.</li>
            <li>We may terminate your access for breaching these Terms, with notice where possible.</li>
            <li>Upon termination, you must cease using the app, and any outstanding payments remain due.</li>
          </ul>

          <h2>11. Governing Law</h2>
          <ul>
            <li>These Terms are governed by New Zealand law, and you submit to the exclusive jurisdiction of New Zealand courts.</li>
          </ul>

          <h2>12. Contact Us</h2>
          <ul>
            <li>For questions or support, contact:
              <ul>
                <li>Email: support@tap4service.co.nz</li>
                <li>Phone: 0800 737 774</li>
                <li>Address: Tap4Service Limited, Auckland, New Zealand</li>
              </ul>
            </li>
          </ul>

          <p>By using Tap4Service, you acknowledge that you have read and agree to these Terms and Conditions.</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="mt-8 w-full bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xl font-semibold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-105 transition transform duration-200"
        >
          Back
        </button>
      </div>
    </div>
  );
}