import { customAlphabet } from "nanoid";

/**
 * Alphabet for room codes (alphanumeric, excluding ambiguous characters)
 * Excludes: 0, O, I, l to avoid confusion
 */
const ROOM_CODE_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Room code length
 */
export const ROOM_CODE_LENGTH = 8;

/**
 * Nanoid generator for room codes
 */
const generateRoomCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

/**
 * Generate a unique 8-character alphanumeric room code
 * Example: 'A3X7K9'
 */
export function createRoomCode(): string {
	return generateRoomCode();
}

/**
 * Validate a room code format
 * Returns true if the code is valid (8 alphanumeric characters)
 */
export function isValidRoomCode(code: string): boolean {
	if (!code || typeof code !== "string") {
		return false;
	}

	// Check length
	if (code.length !== ROOM_CODE_LENGTH) {
		return false;
	}

	// Check if all characters are in the alphabet
	return code.split("").every((char) => ROOM_CODE_ALPHABET.includes(char));
}

/**
 * Format a room code for display (add visual separators if needed)
 * Currently just uppercase, can be extended
 */
export function formatRoomCode(code: string): string {
	return code.toUpperCase();
}

/**
 * Parse a room code from user input (normalize)
 * Removes spaces, converts to uppercase
 */
export function parseRoomCode(input: string): string {
	return input.replace(/\s/g, "").toUpperCase();
}
