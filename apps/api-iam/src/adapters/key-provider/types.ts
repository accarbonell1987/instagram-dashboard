import type { JWK, KeyLike } from 'jose'

export interface KeyProvider {
  getSigningKey(): Promise<{ privateKey: KeyLike; kid: string }>
  getVerifyingKeys(): Promise<Array<{ publicKey: KeyLike; kid: string }>>
  getJwks(): Promise<{ keys: JWK[] }>
}
