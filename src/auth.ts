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

export function getDisplayName(): string | undefined {
  const user = clerk.user;
  if (!user) return undefined;
  // Privacy: Prefer username (chosen by user), then firstName only, never fullName
  // Last resort: email prefix (still somewhat anonymous)
  return user.username || user.firstName || user.primaryEmailAddress?.emailAddress?.split('@')[0];
}
