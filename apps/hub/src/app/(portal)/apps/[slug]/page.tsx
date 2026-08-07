import { ProductShell } from '@/modules/shared/modules/index';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug: productId } = await params;
  return <ProductShell productId={productId} />;
}
