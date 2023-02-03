//
// ed25519_keypair.ts
// Copyright (C) 2023 db3.network Author imotai <codego.me@gmail.com>
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

import nacl from 'tweetnacl'
import type { Keypair } from './keypair'
import { SignatureScheme, SIGNATURE_SCHEME_TO_FLAG } from './publickey'
import { Ed25519PublicKey } from './ed25519_publickey'
import { mnemonicToSeedHex, isValidHardenedPath } from './mnemonics'
import { derivePath, getPublicKey, toB64 } from './crypto_utils'

export const DEFAULT_ED25519_DERIVATION_PATH = "m/44'/784'/0'/0'/0'"

const ED25519_SIGNATURE_LEN = 64
const ED25519_PUBLIC_LEN = 64
const DB3_ED25519_SIGNATURE_LEN = ED25519_SIGNATURE_LEN + ED25519_PUBLIC_LEN + 1
/**
 * Ed25519 Keypair data
 */
export interface Ed25519KeypairData {
    publicKey: Uint8Array
    secretKey: Uint8Array
}

export class Ed25519Keypair implements Keypair {
    /**
     * Create a new Ed25519 keypair instance.
     * Generate random keypair if no {@link Ed25519Keypair} is provided.
     *
     * @param keypair Ed25519 keypair
     */
    constructor(keypair?: Ed25519KeypairData) {
        if (keypair) {
            this.keypair = keypair
        } else {
            this.keypair = nacl.sign.keyPair()
        }
    }

    /**
     * Generate a new Ed25519 keypair instance.
     *
     */
    static generate(): Ed25519Keypair {
        return new Ed25519Keypair(nacl.sign.keyPair())
    }

    /**
     * Get the key scheme of the keypair ED25519
     */
    getKeyScheme(): SignatureScheme {
        return 'ED25519'
    }

    /**
     * Generate an Ed25519 keypair from a 32 byte seed.
     *
     * @param seed seed byte array
     */
    static fromSeed(seed: Uint8Array): Ed25519Keypair {
        const seedLength = seed.length
        if (seedLength != 32) {
            throw new Error(
                `Wrong seed size. Expected 32 bytes, got ${seedLength}.`
            )
        }
        return new Ed25519Keypair(nacl.sign.keyPair.fromSeed(seed))
    }

    /**
     * Return the signature for the provided data using Ed25519.
     */
    signData(data: Uint8Array): Uint8Array {
        const signature = nacl.sign.detached(data, this.keypair.secretKey)
        const buf = new Uint8Array(DB3_ED25519_SIGNATURE_LEN)
        buf[0] = SIGNATURE_SCHEME_TO_FLAG['ED25519']
        for (let i = 0; i < signature.length; i++) {
            buf[i + 1] = signature[i]
        }
        for (let i = 0; i < this.keypair.publicKey.length; i++) {
            buf[i + 1 + ED25519_SIGNATURE_LEN] = this.keypair.publicKey[i]
        }
        return buf
    }

    static deriveKeypair(mnemonics: string, path?: string): Ed25519Keypair {
        if (path == null) {
            path = DEFAULT_ED25519_DERIVATION_PATH
        }
        if (!isValidHardenedPath(path)) {
            throw new Error('Invalid derivation path')
        }
        const { key } = derivePath(path, mnemonicToSeedHex(mnemonics))
        const pubkey = getPublicKey(key, false)

        // Ed25519 private key returned here has 32 bytes. NaCl expects 64 bytes where the last 32 bytes are the public key.
        let fullPrivateKey = new Uint8Array(64)
        fullPrivateKey.set(key)
        fullPrivateKey.set(pubkey, 32)

        return new Ed25519Keypair({
            publicKey: pubkey,
            secretKey: fullPrivateKey,
        })
    }

    getPublicKey(): Ed25519PublicKey {
        return new Ed25519PublicKey(this.keypair.publicKey)
    }

    export(): ExportedKeypair {
        return {
            schema: 'ED25519',
            privateKey: toB64(this.keypair.secretKey),
        }
    }
}
