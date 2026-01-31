import { requireInternalRole } from '@/lib/auth/permissions';
import { getAllTagsAction } from '@/app/app/actions/tags';
import { TagsList } from '@/components/tags/tags-list';
import { CreateTagButton } from '@/components/tags/create-tag-button';

export default async function TagsPage() {
  await requireInternalRole();
  const tags = await getAllTagsAction();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ticket Tags</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage tags for organizing and filtering tickets
          </p>
        </div>
        <CreateTagButton />
      </div>

      <TagsList tags={tags} />
    </div>
  );
}

