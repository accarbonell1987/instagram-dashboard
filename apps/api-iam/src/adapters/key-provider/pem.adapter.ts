import { readFileSync } from 'node:fs'
import { importPKCS8, importSPKI, exportJWK } from 'jose'
import type { JWK, KeyLike } from 'jose'
import type { Config } from '../../config.js'
import type { KeyProvider } from './types.js'

export class PemKeyProvider implements KeyProvider {
  private readonly config: Config
  private signingKey: { privateKey: KeyLike; kid: string } | undefined
  private verifyingKeys: Array<{ publicKey: KeyLike; kid: string }> | undefined

  constructor(config: Config) {
    this.config = config
  }

  async getSigningKey(): Promise<{ privateKey: KeyLike; kid: string }> {
    if (!this.signingKey) {
      const pem = readFileSync(this.config.JWT_PRIVATE_KEY_PATH, 'utf-8')
      const privateKey = await importPKCS8(pem, 'RS256')
      this.signingKey = { privateKey, kid: this.config.JWT_ACTIVE_KID }
    }
    return this.signingKey
  }

  async getVerifyingKeys(): Promise<Array<{ publicKey: KeyLike; kid: string }>> {
    if (!this.verifyingKeys) {
      const activePem = readFileSync(this.config.JWT_PUBLIC_KEY_PATH, 'utf-8')
      const activeKey = await importSPKI(activePem, 'RS256')
      const keys: Array<{ publicKey: KeyLike; kid: string }> = [
        { publicKey: activeKey, kid: this.config.JWT_ACTIVE_KID },
      ]

      if (this.config.JWT_PREVIOUS_PUBLIC_KEY_PATH && this.config.JWT_PREVIOUS_KID) {
        const prevPem = readFileSync(this.config.JWT_PREVIOUS_PUBLIC_KEY_PATH, 'utf-8')
        const prevKey = await importSPKI(prevPem, 'RS256')
        keys.push({ publicKey: prevKey, kid: this.config.JWT_PREVIOUS_KID })
      }

      this.verifyingKeys = keys
    }
    return this.verifyingKeys
  }

  async getJwks(): Promise<{ keys: JWK[] }> {
    const verifyingKeys = await this.getVerifyingKeys()
    const jwks = await Promise.all(
      verifyingKeys.map(async ({ publicKey, kid }) => {
        const jwk = await exportJWK(publicKey)
        return { ...jwk, use: 'sig', alg: 'RS256', kid }
      })
    )
    return { keys: jwks }
  }
}
