import { describe, expect, it } from 'vitest';

import {
	decryptLibraryBackup,
	encryptLibraryBackup,
	isEncryptedLibraryBackup,
	validateBackupPassphrase
} from './backup-crypto';

const passphrase = 'correct horse battery staple';

describe('encrypted library backups', () => {
	it('round-trips the complete backup payload', async () => {
		const plaintext = new Uint8Array([0x50, 0x4b, 1, 2, 3, 4]);
		const encrypted = await encryptLibraryBackup(plaintext, passphrase);

		expect(isEncryptedLibraryBackup(encrypted)).toBe(true);
		expect(isEncryptedLibraryBackup(plaintext)).toBe(false);
		expect(await decryptLibraryBackup(encrypted, passphrase)).toEqual(plaintext);
	});

	it('uses fresh random salt and IV for every export', async () => {
		const plaintext = new Uint8Array([0x50, 0x4b, 1]);
		const first = await encryptLibraryBackup(plaintext, passphrase);
		const second = await encryptLibraryBackup(plaintext, passphrase);

		expect(first).not.toEqual(second);
	});

	it('rejects incorrect passphrases and modified ciphertext', async () => {
		const encrypted = await encryptLibraryBackup(new Uint8Array([0x50, 0x4b, 1]), passphrase);
		await expect(decryptLibraryBackup(encrypted, 'this password is incorrect')).rejects.toThrow(
			'incorrect or the encrypted backup was modified'
		);

		const modified = encrypted.slice();
		modified[modified.length - 1] ^= 1;
		await expect(decryptLibraryBackup(modified, passphrase)).rejects.toThrow(
			'incorrect or the encrypted backup was modified'
		);
	});

	it('requires a meaningful passphrase', () => {
		expect(() => validateBackupPassphrase('too short')).toThrow('at least 12 characters');
		expect(() => validateBackupPassphrase(passphrase)).not.toThrow();
	});
});
