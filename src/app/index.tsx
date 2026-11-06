import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';

/**
 * `/` has no screen of its own — it just redirects into the guarded groups so cold
 * starts (and the dev server's default landing route) don't hit the router's
 * built-in "unmatched route" screen. `Stack.Protected` in the root layout still
 * enforces the actual guard for deep links straight into `(app)/*`.
 */
export default function Index() {
  const { isSignedIn } = useAuth();
  return <Redirect href={isSignedIn ? '/home' : '/welcome'} />;
}
