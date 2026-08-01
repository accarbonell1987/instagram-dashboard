/**
 * Product Generator — Tests
 * Scaffolds `products/{name}/{api,web}` by composing the existing api/webapp
 * generators, plus a `product.config.ts` declaration (modules, plans, roles).
 * @core/cli
 */

import os from 'node:os';
import path from 'node:path';

import fsExtra from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { generateProduct } from './product.generator.js';

const fs = fsExtra;

describe('generateProduct', () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tmpDirs.splice(0).map((dir) => fs.remove(dir)));
  });

  /** Returns a fresh, not-yet-existing product target dir inside a throwaway sandbox */
  async function makeTmpTargetDir(): Promise<string> {
    const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'core-cli-product-'));
    tmpDirs.push(sandbox);
    return path.join(sandbox, 'demo-product');
  }

  it('scaffolds an api/ and web/ directory by composing the existing generators', async () => {
    const targetDir = await makeTmpTargetDir();

    const result = await generateProduct({ name: 'demo-product', targetDir });

    expect(result.success).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'api', 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(targetDir, 'web', 'package.json'))).toBe(true);
  });

  it('writes a product.config.ts declaring the default module, plan, and role', async () => {
    const targetDir = await makeTmpTargetDir();

    const result = await generateProduct({ name: 'demo-product', targetDir });

    const configPath = path.join(targetDir, 'product.config.ts');
    expect(result.createdFiles).toContain(configPath);

    const content = await fs.readFile(configPath, 'utf-8');
    expect(content).toContain('"id": "demo-product-core"');
    expect(content).toContain('"id": "starter"');
    expect(content).toContain('"key": "member"');
    expect(content).toContain('export async function seedProduct(');
  });

  it('fails without creating anything when the target directory already exists', async () => {
    const targetDir = await makeTmpTargetDir();
    await fs.ensureDir(targetDir);

    const result = await generateProduct({ name: 'demo-product', targetDir });

    expect(result.success).toBe(false);
    expect(result.message).toContain('already exists');
    expect(await fs.pathExists(path.join(targetDir, 'api'))).toBe(false);
  });
});
