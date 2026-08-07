export { ProductShell } from './components/product-shell';
export { ProductNotAvailable } from './components/product-not-available';
export { useProducts } from './hooks/use-products';
export { getAvailableProducts } from './services/products.service';
export type { AvailableProduct, ProductModule } from './services/products.service';
export { resolveProductUrl } from './lib/resolve-url';
export { HubToModuleSchema, ModuleToHubSchema } from './lib/post-message-protocol';
export type { HubToModule, ModuleToHub } from './lib/post-message-protocol';
