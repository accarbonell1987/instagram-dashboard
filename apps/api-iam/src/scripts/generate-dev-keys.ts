import { generateKeyPair } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const generateKeyPairAsync = promisify(generateKeyPair)
const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const { privateKey, publicKey } = await generateKeyPairAsync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const keysDir = resolve(__dirname, '../../keys')
  mkdirSync(keysDir, { recursive: true })

  writeFileSync(resolve(keysDir, 'private.pem'), privateKey)
  writeFileSync(resolve(keysDir, 'public.pem'), publicKey)

  console.log('Keys generated at apps/api-iam/keys/')
  console.log('Add to .env:')
  console.log(`  JWT_PRIVATE_KEY_PATH=./keys/private.pem`)
  console.log(`  JWT_PUBLIC_KEYS_PATH=./keys/public.pem`)
}

main().catch(console.error)
