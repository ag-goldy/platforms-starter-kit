'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { CreateTagDialog } from './create-tag-dialog';

export function CreateTagButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Create Tag</Button>
      {isOpen && <CreateTagDialog onClose={() => setIsOpen(false)} />}
    </>
  );
}

