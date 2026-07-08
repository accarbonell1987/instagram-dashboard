import fs from 'fs';
import path from 'path';

import matter from 'gray-matter';

const contentDirectory = path.join(process.cwd(), 'src/content');

export interface DocumentMetadata {
  title: string;
  description?: string;
  category?: string;
  order?: number;
  date?: string;
  [key: string]: unknown;
}

export interface Document {
  slug: string;
  metadata: DocumentMetadata;
  content: string;
}

/**
 * Recursively get all markdown files from a directory
 */
function getMarkdownFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Obtiene todos los archivos markdown del directorio de contenido (recursivamente)
 */
export function getAllDocuments(): Document[] {
  const files = getMarkdownFiles(contentDirectory);

  const documents = files
    .map((fullPath) => {
      // Generate slug from relative path (e.g., "api-example/users" from "api-example/users.md")
      const relativePath = path.relative(contentDirectory, fullPath);
      const slug = relativePath.replace(/\.md$/, '').replace(/\\/g, '/');

      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const { data, content } = matter(fileContents);

      const title = (data['title'] as string | undefined) ?? path.basename(slug);
      const description = data['description'] as string | undefined;
      const category = data['category'] as string | undefined;
      const order = (data['order'] as number | undefined) ?? 999;

      return {
        slug,
        metadata: {
          title,
          ...(description !== undefined && { description }),
          ...(category !== undefined && { category }),
          order,
          ...data,
        },
        content,
      };
    })
    .sort((a, b) => a.metadata.order - b.metadata.order);

  return documents;
}

/**
 * Obtiene un documento específico por su slug (supports nested paths like "api-example/users")
 */
export function getDocumentBySlug(slug: string): Document | null {
  try {
    // Normalize slug for file system (handle both forward and back slashes)
    const normalizedSlug = slug.replace(/\\/g, '/');
    const fullPath = path.join(contentDirectory, `${normalizedSlug}.md`);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(fileContents);

    const title = (data['title'] as string | undefined) ?? path.basename(slug);
    const description = data['description'] as string | undefined;
    const category = data['category'] as string | undefined;
    const order = (data['order'] as number | undefined) ?? 999;

    return {
      slug: normalizedSlug,
      metadata: {
        title,
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        order,
        ...data,
      },
      content,
    };
  } catch {
    return null;
  }
}

/**
 * Genera metadata para Next.js
 */
export function generateDocumentMetadata(slug: string) {
  const doc = getDocumentBySlug(slug);

  if (!doc) {
    return {
      title: 'Document Not Found',
    };
  }

  return {
    title: doc.metadata.title,
    description: doc.metadata.description ?? `Documentation for ${doc.metadata.title}`,
  };
}
