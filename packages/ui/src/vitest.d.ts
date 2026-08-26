// Los matchers de jest-dom se registran en runtime desde `vitest.setup.ts`, que
// vive en la raiz del paquete: fuera del `include` del tsconfig, y no se puede
// agregar ahi porque `rootDir` es `src` y tsc responde TS6059.
//
// Sin esta linea TypeScript no ve la ampliacion de la interfaz Assertion: los
// tests corren verdes y `tsc` falla con "Property 'toBeInTheDocument' does not
// exist". El entrypoint es `/vitest`; el raiz amplia los tipos de Jest.
import '@testing-library/jest-dom/vitest';
