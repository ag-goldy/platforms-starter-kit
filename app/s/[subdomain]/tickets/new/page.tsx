import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewTicketForm } from './new-ticket-form';

export default async function NewTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const { subdomain } = await params;

  if (!session?.user) {
    redirect(`/s/${subdomain}/login?redirect=/s/${subdomain}/tickets/new`);
  }

  await searchParams;

  return (
    <div className="mx-auto max-w-4xl py-2 sm:py-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        <div className="mb-8 flex items-center gap-4">
          <Link href={`/s/${subdomain}/tickets`}>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-10 w-10 rounded-xl border border-gray-200 hover:bg-orange-50 hover:border-orange-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Create New Ticket
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Submit a support request and track its progress
            </p>
          </div>
        </div>

        <NewTicketForm subdomain={subdomain} />
    </div>
  );
}
