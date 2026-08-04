export interface Product {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  trialEnabled: boolean;
  trialDurationDays: number;
}

export async function fetchProducts(): Promise<Product[]> {
  const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';
  const res = await fetch(`${base}/products`, { method: 'GET' });
  if (!res.ok) throw new Error('Error al cargar productos');
  const data = (await res.json()) as { products: Product[] };
  return data.products;
}
