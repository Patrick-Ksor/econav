import { createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!,
});

/**
 * Verifies the Clerk session token on an incoming API route request and
 * returns the signed-in user's id, or null if the request isn't authenticated.
 */
export async function getAuthUserId(request: Request): Promise<string | null> {
  const requestState = await clerkClient.authenticateRequest(request);
  return requestState.toAuth()?.userId ?? null;
}
