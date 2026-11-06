import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native';
import { act } from 'react';

import { SignInScreen } from '@/features/auth/SignInScreen';
import { useGoogleSignIn } from '@/hooks/use-google-sign-in';

import { renderScreen, resetAppState } from '../helpers/render';

const clerk = jest.requireMock('@clerk/expo') as { __startSSOFlow: jest.Mock };
const startSSO = clerk.__startSSOFlow;

// The browser/session helpers are native; the hook only needs their shape.
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'econav://') }));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  warmUpAsync: jest.fn(async () => {}),
  coolDownAsync: jest.fn(async () => {}),
}));

beforeEach(() => {
  resetAppState();
  startSSO.mockReset();
});

describe('useGoogleSignIn', () => {
  test('starts Clerk\'s Google flow and returns to the app root', async () => {
    startSSO.mockResolvedValue({ createdSessionId: null, setActive: undefined });
    const { result } = await renderHook(() => useGoogleSignIn());
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(startSSO).toHaveBeenCalledWith({ strategy: 'oauth_google', redirectUrl: 'econav://' });
  });

  test('activates the session Clerk created', async () => {
    const setActive = jest.fn(async () => {});
    startSSO.mockResolvedValue({ createdSessionId: 'sess_123', setActive });
    const { result } = await renderHook(() => useGoogleSignIn());
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(setActive).toHaveBeenCalledWith({ session: 'sess_123' });
  });

  test('does nothing further when the user backs out (no session created)', async () => {
    const setActive = jest.fn(async () => {});
    startSSO.mockResolvedValue({ createdSessionId: null, setActive });
    const { result } = await renderHook(() => useGoogleSignIn());
    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(setActive).not.toHaveBeenCalled();
  });

  test('lets a failure reach the caller', async () => {
    startSSO.mockRejectedValue(new Error('network down'));
    const { result } = await renderHook(() => useGoogleSignIn());
    await expect(result.current.signInWithGoogle()).rejects.toThrow('network down');
  });
});

describe('SignInScreen', () => {
  const show = () => renderScreen(<SignInScreen />, { settle: false });
  const google = () => screen.getByRole('button', { name: /Continue with Google|Signing in…/ });

  test('welcomes the user and offers Google', async () => {
    await show();
    expect(screen.getByText('Welcome to EcoNav')).toBeTruthy();
    expect(screen.getByText('Drive smarter. Save on every mile.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
  });

  test('Apple is shown as coming soon and is not a button', async () => {
    await show();
    expect(screen.getByText('Apple — coming soon')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Apple/ })).toBeNull();
  });

  test('no error is shown until something fails', async () => {
    await show();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('pressing Google starts the sign-in', async () => {
    startSSO.mockResolvedValue({ createdSessionId: null, setActive: undefined });
    await show();
    await fireEvent.press(google());
    await waitFor(() => expect(startSSO).toHaveBeenCalledTimes(1));
  });

  test('while signing in, the button reads "Signing in…" and cannot be pressed twice', async () => {
    let finish: (v: unknown) => void = () => {};
    startSSO.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await show();
    // Not awaited: fireEvent waits for the handler's promise, which stays pending until we resolve it.
    const firstPress = fireEvent.press(google());

    expect(await screen.findByText('Signing in…')).toBeTruthy();
    expect(google()).toBeDisabled();
    await fireEvent.press(google()); // a second tap while disabled does nothing
    expect(startSSO).toHaveBeenCalledTimes(1);

    await act(async () => finish({ createdSessionId: null, setActive: undefined }));
    await firstPress;
    expect(await screen.findByText('Continue with Google')).toBeTruthy();
  });

  test('a failure shows its message and lets the user try again', async () => {
    startSSO.mockRejectedValueOnce(new Error('Google sign-in was cancelled'));
    await show();
    await fireEvent.press(google());

    expect(await screen.findByText('Google sign-in was cancelled')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();

    startSSO.mockResolvedValueOnce({ createdSessionId: null, setActive: undefined });
    await fireEvent.press(google());
    await waitFor(() => expect(screen.queryByText('Google sign-in was cancelled')).toBeNull());
  });

  test('a failure with no message falls back to a generic one', async () => {
    startSSO.mockRejectedValueOnce('boom');
    await show();
    await fireEvent.press(google());
    expect(await screen.findByText('Sign in failed')).toBeTruthy();
  });
});
