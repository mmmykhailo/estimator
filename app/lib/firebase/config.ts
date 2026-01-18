import { type FirebaseApp, initializeApp } from "firebase/app";
import {
	type Auth,
	getAuth,
	onAuthStateChanged,
	signInAnonymously,
	type User,
} from "firebase/auth";
import { type Database, getDatabase } from "firebase/database";

/**
 * Firebase configuration from environment variables
 */
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

/**
 * Validate that all required Firebase environment variables are present
 */
function validateFirebaseConfig(): void {
	const required = [
		"VITE_FIREBASE_API_KEY",
		"VITE_FIREBASE_AUTH_DOMAIN",
		"VITE_FIREBASE_DATABASE_URL",
		"VITE_FIREBASE_PROJECT_ID",
	];

	const missing = required.filter((key) => !import.meta.env[key]);

	if (missing.length > 0) {
		throw new Error(
			`Missing required Firebase environment variables: ${missing.join(", ")}\n` +
				"Please create a .env.local file with your Firebase credentials. " +
				"See .env.example for the required format.",
		);
	}
}

// Validate config on module load
validateFirebaseConfig();

/**
 * Firebase app instance
 */
export const app: FirebaseApp = initializeApp(firebaseConfig);

/**
 * Firebase Realtime Database instance
 */
export const database: Database = getDatabase(app);

/**
 * Firebase Authentication instance
 */
export const auth: Auth = getAuth(app);

/**
 * Wait for Firebase auth to be ready and return the current user.
 * If no user is signed in, signs in anonymously.
 * This ensures the auth token is fully propagated before database operations.
 */
export function ensureAuth(): Promise<User> {
	return new Promise((resolve, reject) => {
		const unsubscribe = onAuthStateChanged(
			auth,
			async (user) => {
				unsubscribe();
				if (user) {
					resolve(user);
				} else {
					try {
						const credential = await signInAnonymously(auth);
						resolve(credential.user);
					} catch (error) {
						reject(error);
					}
				}
			},
			reject,
		);
	});
}
