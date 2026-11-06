import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { EmptyState } from '@/components/empty-state';
import { PrimaryButton, SecondaryButton } from '@/components/primary-button';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { useAppearanceStore } from '@/stores/appearance-store';

describe('StatusBadge', () => {
  test('labels a confirmed trip', async () => {
    await render(<StatusBadge status="confirmed" />);
    expect(screen.getByText('Confirmed')).toBeTruthy();
  });

  test('labels a pending trip', async () => {
    await render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeTruthy();
  });
});

describe('PrimaryButton', () => {
  test('shows its label and calls onPress', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Save vehicle" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save vehicle' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('does nothing while disabled', async () => {
    const onPress = jest.fn();
    await render(<PrimaryButton label="Save vehicle" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save vehicle' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('exposes the disabled state to assistive tech', async () => {
    await render(<PrimaryButton label="Continue" onPress={() => {}} disabled />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});

describe('SecondaryButton', () => {
  test('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<SecondaryButton label="Open in Maps without comparing" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Maps without comparing' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyState', () => {
  test('shows the title, explanation and an action that fires', async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState
        illustration={null}
        title="No trips yet"
        body="Plan a drive, then confirm it when you're back."
        actionLabel="Plan your first trip"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('No trips yet')).toBeTruthy();
    expect(screen.getByText("Plan a drive, then confirm it when you're back.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Plan your first trip' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test('renders extra footer content under the action', async () => {
    await render(
      <EmptyState
        illustration={null}
        title="We couldn't calculate routes"
        body="The routing service isn't responding."
        actionLabel="Try again"
        onAction={() => {}}
        footer={<SecondaryButton label="Open in Maps without comparing" onPress={() => {}} />}
      />,
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open in Maps without comparing' })).toBeTruthy();
  });
});

describe('theming', () => {
  // Reset inside act: the previous test's tree is still mounted and subscribed to the store.
  afterEach(async () => {
    await act(async () => {
      useAppearanceStore.setState({ mode: 'system' });
    });
  });

  test('text uses the light palette when Appearance is Light', async () => {
    useAppearanceStore.setState({ mode: 'light' });
    await render(<ThemedText testID="t">Hello</ThemedText>);
    expect(screen.getByTestId('t')).toHaveStyle({ color: '#0F172A' });
  });

  test('text uses the dark palette when Appearance is Dark', async () => {
    useAppearanceStore.setState({ mode: 'dark' });
    await render(<ThemedText testID="t">Hello</ThemedText>);
    expect(screen.getByTestId('t')).toHaveStyle({ color: '#F1F5F9' });
  });
});
