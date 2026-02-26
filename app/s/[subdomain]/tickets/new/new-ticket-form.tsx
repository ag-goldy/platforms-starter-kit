'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  Zap,
  Loader2
} from 'lucide-react';
import { createCustomerTicketWithAttachmentsAction } from '@/app/s/[subdomain]/actions/tickets';

interface NewTicketFormProps {
  subdomain: string;
}

const categories = [
  { id: 'INCIDENT', name: 'Incident' },
  { id: 'SERVICE_REQUEST', name: 'Service Request' },
  { id: 'CHANGE_REQUEST', name: 'Change Request' },
  { id: 'PROBLEM', name: 'Problem' },
];

export function NewTicketForm({ subdomain }: NewTicketFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createCustomerTicketWithAttachmentsAction(formData);
      
      if (result.error) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      if (result.ticketId) {
        router.push(`/s/${subdomain}/tickets/${result.ticketId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
      setIsSubmitting(false);
    }
  }

  return (
    <form action={handleSubmit} className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
      <input type="hidden" name="subdomain" value={subdomain} />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900 text-sm">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="space-y-8">
        <div className="space-y-3">
          <Label htmlFor="subject" className="text-gray-900 font-semibold text-sm uppercase tracking-wider">
            Ticket Title <span className="text-orange-500">*</span>
          </Label>
          <Input 
            id="subject"
            name="subject"
            placeholder="E.g., Login issue on dashboard"
            required
            disabled={isSubmitting}
            className="h-14 border-gray-200 focus:border-black focus:ring-black rounded-xl text-base placeholder:text-gray-400"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label htmlFor="category" className="text-gray-900 font-semibold text-sm uppercase tracking-wider">
              Category
            </Label>
            <div className="relative">
              <select
                id="category"
                name="category"
                disabled={isSubmitting}
                className="w-full h-14 px-4 border border-gray-200 rounded-xl focus:border-black focus:ring-black bg-white appearance-none text-base disabled:bg-gray-50"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowLeft className="w-4 h-4 text-gray-400 -rotate-90" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="priority" className="text-gray-900 font-semibold text-sm uppercase tracking-wider">
              Priority
            </Label>
            <div className="relative">
              <select
                id="priority"
                name="priority"
                disabled={isSubmitting}
                className="w-full h-14 px-4 border border-gray-200 rounded-xl focus:border-black focus:ring-black bg-white appearance-none text-base disabled:bg-gray-50"
              >
                <option value="P4">Low - General inquiry</option>
                <option value="P3">Normal - Minor issue</option>
                <option value="P2">High - Significant impact</option>
                <option value="P1">Critical - System down</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowLeft className="w-4 h-4 text-gray-400 -rotate-90" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="description" className="text-gray-900 font-semibold text-sm uppercase tracking-wider">
            Description <span className="text-orange-500">*</span>
          </Label>
          <Textarea 
            id="description"
            name="description"
            placeholder="Please provide as much detail as possible about your issue..."
            required
            disabled={isSubmitting}
            rows={6}
            className="resize-none border-gray-200 focus:border-black focus:ring-black rounded-xl text-base placeholder:text-gray-400 p-4 disabled:bg-gray-50"
          />
        </div>

        <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            SLA Guidelines
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PriorityGuide 
              icon={<CheckCircle className="w-4 h-4 text-gray-400" />}
              level="Low / Normal"
              desc="General questions & minor issues"
              time="24-48 hours"
            />
            <PriorityGuide 
              icon={<Clock className="w-4 h-4 text-orange-500" />}
              level="High"
              desc="Significant workflow impact"
              time="8 hours"
            />
            <PriorityGuide 
              icon={<AlertCircle className="w-4 h-4 text-black" />}
              level="Critical"
              desc="System outage or blocker"
              time="2 hours"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <Button 
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="flex-1 bg-black hover:bg-gray-900 text-white h-14 rounded-xl text-base font-medium shadow-lg shadow-gray-200 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin text-orange-500" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2 text-orange-500" />
                Submit Ticket
              </>
            )}
          </Button>
          <Button 
            type="button"
            variant="outline"
            size="lg"
            disabled={isSubmitting}
            onClick={() => router.push(`/s/${subdomain}/tickets`)}
            className="flex-1 sm:flex-initial h-14 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

function PriorityGuide({ icon, level, desc, time }: { icon: React.ReactNode; level: string; desc: string; time: string }) {
  return (
    <div className="flex items-start gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
      <div className="mt-0.5">{icon}</div>
      <div>
        <span className="font-bold text-gray-900 text-sm block mb-0.5">{level}</span>
        <p className="text-xs text-gray-500 leading-snug">{desc}</p>
        <p className="text-xs text-orange-600 font-medium mt-1.5">Est. Response: {time}</p>
      </div>
    </div>
  );
}
