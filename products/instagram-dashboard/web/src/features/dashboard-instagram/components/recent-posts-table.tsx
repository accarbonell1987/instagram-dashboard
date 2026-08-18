import { Badge, DataTable, Td, Th, Tr } from '@core/ui';

import type { InstagramPost, PostType } from '../types/instagram.types';

const POST_TYPE_LABELS: Record<PostType, string> = {
  image: 'Imagen',
  video: 'Video',
  carousel: 'Carrusel',
  reel: 'Reel',
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function PostRow({ post }: { post: InstagramPost }) {
  return (
    <Tr>
      <Td>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.thumbnailUrl}
            alt=""
            className="h-10 w-10 rounded-md object-cover"
            loading="lazy"
          />
          <div className="min-w-0">
            <p className="max-w-xs truncate text-sm font-medium" title={post.caption}>
              {post.caption || 'Sin descripción'}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {POST_TYPE_LABELS[post.type]}
              </Badge>
              {post.isTopPerformer && (
                <Badge variant="default" className="text-[10px]">
                  Top
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Td>
      <Td className="text-right text-sm tabular-nums">{formatCount(post.metrics.likes)}</Td>
      <Td className="hidden text-right text-sm tabular-nums sm:table-cell">
        {formatCount(post.metrics.comments)}
      </Td>
      <Td className="hidden text-right text-sm tabular-nums lg:table-cell">
        {post.metrics.engagementRate.toFixed(1)}%
      </Td>
      <Td className="hidden text-right text-sm tabular-nums lg:table-cell">
        {formatCount(post.metrics.impressions)}
      </Td>
      <Td className="hidden text-right text-sm tabular-nums lg:table-cell">
        {formatCount(post.metrics.reach)}
      </Td>
    </Tr>
  );
}

export function RecentPostsTable({ posts }: { posts: InstagramPost[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Publicaciones recientes</h3>
      <DataTable
        isEmpty={posts.length === 0}
        empty={{ text: 'No hay publicaciones para mostrar.' }}
        caption="Publicaciones recientes"
        head={
          <>
            <Th>Publicación</Th>
            <Th align="right">Likes</Th>
            <Th align="right" className="hidden sm:table-cell">
              Coment.
            </Th>
            <Th align="right" className="hidden lg:table-cell">
              Engagement
            </Th>
            <Th align="right" className="hidden lg:table-cell">
              Impr.
            </Th>
            <Th align="right" className="hidden lg:table-cell">
              Alcance
            </Th>
          </>
        }
      >
        {posts.map((post) => (
          <PostRow key={post.id} post={post} />
        ))}
      </DataTable>
    </section>
  );
}
