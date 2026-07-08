import { Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@core/ui'

import type { InstagramPost, PostType } from '../types/instagram.types'

const POST_TYPE_LABELS: Record<PostType, string> = {
  image: 'Imagen',
  video: 'Video',
  carousel: 'Carrusel',
  reel: 'Reel',
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function PostRow({ post }: { post: InstagramPost }) {
  return (
    <TableRow className="border-border border-t">
      <TableCell className="px-4 py-3">
        <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
            src={post.thumbnailUrl}
            alt=""
            className="h-10 w-10 rounded-md object-cover"
            loading="lazy"
          />
          <div className="min-w-0">
            <p
              className="max-w-xs truncate text-sm font-medium"
              title={post.caption}
            >
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
      </TableCell>
      <TableCell className="px-4 py-3 text-right text-sm tabular-nums">
        {formatCount(post.metrics.likes)}
      </TableCell>
      <TableCell className="hidden px-4 py-3 text-right text-sm tabular-nums sm:table-cell">
        {formatCount(post.metrics.comments)}
      </TableCell>
      <TableCell className="hidden px-4 py-3 text-right text-sm tabular-nums lg:table-cell">
        {post.metrics.engagementRate.toFixed(1)}%
      </TableCell>
      <TableCell className="hidden px-4 py-3 text-right text-sm tabular-nums lg:table-cell">
        {formatCount(post.metrics.impressions)}
      </TableCell>
      <TableCell className="hidden px-4 py-3 text-right text-sm tabular-nums lg:table-cell">
        {formatCount(post.metrics.reach)}
      </TableCell>
    </TableRow>
  )
}

export function RecentPostsTable({ posts }: { posts: InstagramPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="bg-card border-border rounded-lg border p-6">
        <h3 className="mb-4 text-sm font-semibold">Publicaciones recientes</h3>
        <p className="text-muted-foreground text-center text-sm">
          No hay publicaciones para mostrar.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card border-border overflow-hidden rounded-lg border">
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold">Publicaciones recientes</h3>
      </div>
      <Table className="w-full text-left text-sm">
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="px-4 py-2 font-medium">Publicación</TableHead>
            <TableHead className="px-4 py-2 text-right font-medium">Likes</TableHead>
            <TableHead className="hidden px-4 py-2 text-right font-medium sm:table-cell">
              Coment.
            </TableHead>
            <TableHead className="hidden px-4 py-2 text-right font-medium lg:table-cell">
              Engagement
            </TableHead>
            <TableHead className="hidden px-4 py-2 text-right font-medium lg:table-cell">
              Impr.
            </TableHead>
            <TableHead className="hidden px-4 py-2 text-right font-medium lg:table-cell">
              Alcance
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
