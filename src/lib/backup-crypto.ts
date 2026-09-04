import { z } from 'zod';

export const ENCRYPTED_BACKUP_FORMAT = 'granthalay-encrypted-backup' as const;
export const ENCRYPTED_BACKUP_VERSION = 1 as const;
export const BACKUP_KDF_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const MAX_HEADER_BYTES = 4096;
const MAGIC = new TextEncoder().encode('GRANTHALAY-ENCRYPTED\n');

const headerSchema = z
	.object({
		format: z.literal(ENCRYPTED_BACKUP_FORMAT),
		version: z.literal(ENCRYPTED_BACKUP_VERSION),
		cipher: z.literal('AES-256-GCM'),
		kdf: z.literal('PBKDF2-HMAC-SHA-256'),
		iterations: z.number().int().min(BACKUP_KDF_ITERATIONS).max(10_000_000),
		salt: z.string().min(1).max(128),
		iv: z.string().min(1).max(128)
	})
	.strict();

type EncryptedBackupHeader = z.infer<typeof headerSchema>;

export function validateBackupPassphrase(passphrase: string): void {
	if (passphrase.length < 12)
		throw new Error('Use a backup passphrase with at least 12 characters.');
	if (passphrase.length > 1024) throw new Error('The backup passphrase is too long.');
}

export function encryptedBackupFilename(now = new Date()): string {
	return `granthalay-backup-${now.toISOString().slice(0, 10)}.granthalay`;
}

export function isEncryptedLibraryBackup(data: ArrayBuffer | Uint8Array): boolean {
	const bytes = toBytes(data);
	return MAGIC.every((value, index) => bytes[index] === value);
}

export async function encryptLibraryBackup(
	plaintext: ArrayBuffer | Uint8Array,
	passphrase: string
): Promise<Uint8Array> {
	validateBackupPassphrase(passphrase);
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const header: EncryptedBackupHeader = {
		format: ENCRYPTED_BACKUP_FORMAT,
		version: ENCRYPTED_BACKUP_VERSION,
		cipher: 'AES-256-GCM',
		kdf: 'PBKDF2-HMAC-SHA-256',
		iterations: BACKUP_KDF_ITERATIONS,
		salt: bytesToBase64(salt),
		iv: bytesToBase64(iv)
	};
	const headerBytes = new TextEncoder().encode(JSON.stringify(header));
	const key = await deriveKey(passphrase, salt, header.iterations, ['encrypt']);
	const ciphertext = await crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv: copyArrayBuffer(iv),
			additionalData: copyArrayBuffer(headerBytes),
			tagLength: 128
		},
		key,
		copyArrayBuffer(toBytes(plaintext))
	);
	return joinEnvelope(headerBytes, new Uint8Array(ciphertext));
}

export async function decryptLibraryBackup(
	envelope: ArrayBuffer | Uint8Array,
	passphrase: string
): Promise<Uint8Array> {
	validateBackupPassphrase(passphrase);
	const bytes = toBytes(envelope);
	if (!isEncryptedLibraryBackup(bytes))
		throw new Error('This is not an encrypted Granthalay backup.');
	if (bytes.byteLength < MAGIC.byteLength + 4)
		throw new Error('Encrypted backup header is incomplete.');
	const view = new DataView(bytes.buffer, bytes.byteOffset + MAGIC.byteLength, 4);
	const headerLength = view.getUint32(0, false);
	if (headerLength === 0 || headerLength > MAX_HEADER_BYTES) {
		throw new Error('Encrypted backup header has an invalid size.');
	}
	const headerStart = MAGIC.byteLength + 4;
	const ciphertextStart = headerStart + headerLength;
	if (ciphertextStart >= bytes.byteLength) throw new Error('Encrypted backup payload is missing.');
	const headerBytes = bytes.slice(headerStart, ciphertextStart);
	let unknownHeader: unknown;
	try {
		unknownHeader = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(headerBytes));
	} catch {
		throw new Error('Encrypted backup header is invalid.');
	}
	const parsed = headerSchema.safeParse(unknownHeader);
	if (!parsed.success) throw new Error('Encrypted backup format or algorithms are unsupported.');
	const salt = base64ToBytes(parsed.data.salt, SALT_BYTES, 'salt');
	const iv = base64ToBytes(parsed.data.iv, IV_BYTES, 'initialization vector');
	const key = await deriveKey(passphrase, salt, parsed.data.iterations, ['decrypt']);
	try {
		const plaintext = await crypto.subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: copyArrayBuffer(iv),
				additionalData: copyArrayBuffer(headerBytes),
				tagLength: 128
			},
			key,
			copyArrayBuffer(bytes.slice(ciphertextStart))
		);
		return new Uint8Array(plaintext);
	} catch {
		throw new Error('The passphrase is incorrect or the encrypted backup was modified.');
	}
}

function joinEnvelope(header: Uint8Array, ciphertext: Uint8Array): Uint8Array {
	const output = new Uint8Array(MAGIC.byteLength + 4 + header.byteLength + ciphertext.byteLength);
	output.set(MAGIC, 0);
	new DataView(output.buffer).setUint32(MAGIC.byteLength, header.byteLength, false);
	output.set(header, MAGIC.byteLength + 4);
	output.set(ciphertext, MAGIC.byteLength + 4 + header.byteLength);
	return output;
}

async function deriveKey(
	passphrase: string,
	salt: Uint8Array,
	iterations: number,
	usages: KeyUsage[]
): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(passphrase),
		'PBKDF2',
		false,
		['deriveKey']
	);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: copyArrayBuffer(salt), iterations },
		material,
		{ name: 'AES-GCM', length: 256 },
		false,
		usages
	);
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function base64ToBytes(value: string, expectedLength: number, label: string): Uint8Array {
	let binary: string;
	try {
		binary = atob(value);
	} catch {
		throw new Error(`Encrypted backup ${label} is invalid.`);
	}
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	if (bytes.byteLength !== expectedLength) throw new Error(`Encrypted backup ${label} is invalid.`);
	return bytes;
}

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
	return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function copyArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}
