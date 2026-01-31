'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { CreateTemplateDialog } from './create-template-dialog';

export function CreateTemplateButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Create Template</Button>
      {isOpen && <CreateTemplateDialog onClose={() => setIsOpen(false)} />}
    </>
  );
}

