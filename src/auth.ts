import { Clerk } from '@clerk/clerk-js';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env");
}

export const clerk = new Clerk(PUBLISHABLE_KEY);

export async function initAuth() {
  try {
    await clerk.load();
    console.log("Clerk loaded. User:", clerk.user);
  } catch (err) {
    console.error("Failed to load Clerk:", err);
  }
}

export function getToken() {
  return clerk.session?.getToken();
}
