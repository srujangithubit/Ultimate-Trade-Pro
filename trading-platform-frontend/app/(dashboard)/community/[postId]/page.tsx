'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommunity } from '@/lib/hooks/useCommunity';
import { fadeInUp } from '@/lib/utils/motion';
import PostDetail from '@/components/community/PostDetail';
import Comments from '@/components/community/Comments';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.postId as string;

  const {
    activePost,
    activePostComments,
    commentsLoading,
    fetchPostById,
    fetchComments,
    toggleLike,
    toggleSave,
    addComment,
    replyToComment,
    toggleCommentLike,
    deleteComment,
    deletePost,
  } = useCommunity();

  useEffect(() => {
    if (postId) {
      fetchPostById(postId);
      fetchComments(postId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const handleDelete = async () => {
    if (!activePost) return;
    await deletePost(activePost.id);
    router.push('/community');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <motion.div {...fadeInUp}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </motion.div>

      {activePost ? (
        <>
          <motion.div {...fadeInUp}>
            <PostDetail
              post={activePost}
              onLike={() => toggleLike(activePost.id)}
              onSave={() => toggleSave(activePost.id)}
              onDelete={handleDelete}
            />
          </motion.div>

          <motion.div {...fadeInUp}>
            <Comments
              comments={activePostComments}
              loading={commentsLoading}
              postId={activePost.id}
              onAddComment={(text) =>
                addComment({ postId: activePost.id, text })
              }
              onReply={(parentId, text) => replyToComment(activePost.id, parentId, text)}
              onLike={(commentId) => toggleCommentLike(activePost.id, commentId)}
              onDelete={(commentId) => deleteComment(activePost.id, commentId)}
            />
          </motion.div>
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          Loading post...
        </div>
      )}
    </div>
  );
}
