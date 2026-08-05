import { BlogAdmin } from '@/components/blog-admin';

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BlogAdmin postId={id} />;
}
