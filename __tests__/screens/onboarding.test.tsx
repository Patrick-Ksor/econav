import { fireEvent, screen } from '@testing-library/react-native';

import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

import { mockRouter, renderScreen, resetAppState } from '../helpers/render';

// No network here, so there is nothing to wait for.
const show = () => renderScreen(<OnboardingScreen />, { settle: false });
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const has = (name: string) => screen.queryByRole('button', { name }) !== null;

beforeEach(resetAppState);

describe('Welcome', () => {
  test('opens on the welcome pitch with its two actions', async () => {
    await show();

    expect(screen.getByText('Every Mile. Smarter.')).toBeTruthy();
    expect(screen.getByText(/Find routes that balance fuel costs, time, and vehicle wear/)).toBeTruthy();
    expect(has('Get Started')).toBe(true);
    expect(has('I already have an account')).toBe(true);
  });

  test('shows a sample route card, clearly a demo', async () => {
    await show();
    expect(screen.getByText('Efficient route')).toBeTruthy();
    expect(screen.getByText('$7.50')).toBeTruthy();
  });

  test('has no Back or Skip on the first screen', async () => {
    await show();
    expect(has('Back')).toBe(false);
    expect(has('Skip')).toBe(false);
  });

  test('"I already have an account" goes straight to sign-in', async () => {
    await show();
    await press('I already have an account');
    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  });

  test('marks step 1 of 4', async () => {
    await show();
    expect(screen.getByLabelText('Step 1 of 4')).toBeTruthy();
  });
});

describe('the three intro pages', () => {
  test('"Get Started" opens the vehicle page, and each Next moves forward', async () => {
    await show();
    await press('Get Started');
    expect(screen.getByText('Add your vehicle')).toBeTruthy();
    expect(screen.getByText('RAV4 XLE')).toBeTruthy();
    expect(screen.getByLabelText('Step 2 of 4')).toBeTruthy();

    await press('Next');
    expect(screen.getByText('Compare money and time')).toBeTruthy();
    expect(screen.getByText('Recommended for you')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 4')).toBeTruthy();

    await press('Next');
    expect(screen.getByText('Track your savings')).toBeTruthy();
    expect(screen.getByText('$128.45')).toBeTruthy();
    expect(screen.getByLabelText('Step 4 of 4')).toBeTruthy();
  });

  test('the compare page describes only what the app really does (no toll promise)', async () => {
    await show();
    await press('Get Started');
    await press('Next');
    expect(screen.getByText(/See fuel and wear for every route side by side/)).toBeTruthy();
    expect(screen.queryByText(/toll/i)).toBeNull();
  });

  test('Back returns to the previous page, down to the welcome screen', async () => {
    await show();
    await press('Get Started');
    await press('Next');

    await press('Back');
    expect(screen.getByText('Add your vehicle')).toBeTruthy();
    await press('Back');
    expect(screen.getByText('Every Mile. Smarter.')).toBeTruthy();
    expect(has('Back')).toBe(false);
  });

  test('Skip is offered on pages 2 and 3 and goes to sign-in', async () => {
    await show();
    await press('Get Started');
    expect(has('Skip')).toBe(true);
    await press('Next');
    expect(has('Skip')).toBe(true);

    await press('Skip');
    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  });

  test('the last page has no Skip, and its button creates an account', async () => {
    await show();
    await press('Get Started');
    await press('Next');
    await press('Next');

    expect(has('Skip')).toBe(false);
    expect(has('Next')).toBe(false);
    await press('Create account');
    expect(mockRouter.replace).toHaveBeenCalledWith('/sign-in');
  });

  test('moving between pages never leaves the screen', async () => {
    await show();
    await press('Get Started');
    await press('Next');
    await press('Back');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
