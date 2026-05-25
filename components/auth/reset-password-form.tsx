"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Resetting password..." : "Reset Password"}
    </Button>
  );
}

export function ResetPasswordForm({
  token,
  action,
}: {
  token: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Enter new password"
          minLength={8}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          minLength={8}
          required
        />
      </div>
      <SubmitButton />
    </form>
  );
}
