import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Organization Disabled - Atlas Helpdesk',
  description: 'This organization has been temporarily disabled.',
};

export default function DisabledPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mb-6">
            <AlertTriangle className="w-10 h-10 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Organization Temporarily Disabled
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            This organization has been temporarily disabled by an administrator.
          </p>
          <p className="text-gray-500">
            All portal access is currently blocked. Please contact your administrator for assistance.
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-2">What does this mean?</h2>
            <ul className="text-sm text-gray-600 text-left space-y-2">
              <li>• Customer portal access is blocked</li>
              <li>• Ticket creation and viewing is unavailable</li>
              <li>• Knowledge base articles are not accessible</li>
              <li>• Your data is preserved and secure</li>
            </ul>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Return to Main Site
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-400">
          If you believe this is an error, please contact your system administrator.
        </p>
      </div>
    </div>
  );
}
