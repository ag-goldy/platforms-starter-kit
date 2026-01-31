import { acceptInvitation } from '@/lib/users/invitations';
import { redirect } from 'next/navigation';
import { AcceptInvitationForm } from '@/components/invitations/accept-invitation-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  async function acceptInvitationAction(formData: FormData) {
    'use server';
    const name = formData.get('name') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    await acceptInvitation(token, {
      name: name || undefined,
      password,
    });

    // Redirect to login after successful acceptance
    redirect('/login?invited=true');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Invitation</CardTitle>
          <CardDescription>
            Create your account to join the organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInvitationForm onSubmit={acceptInvitationAction} />
        </CardContent>
      </Card>
    </div>
  );
}
