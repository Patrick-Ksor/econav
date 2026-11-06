import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, InterFont, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'moneyXl'
    | 'display'
    | 'heading'
    | 'overline';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? (type === 'linkPrimary' ? 'tint' : 'text')] },
        styles[type],
        style,
      ]}
      {...rest}
    />
  );
}

// Type scale from the design handoff. Numbers use tabular figures throughout.
const styles = StyleSheet.create({
  moneyXl: {
    fontFamily: InterFont.extrabold,
    fontSize: 46,
    lineHeight: 46,
    letterSpacing: -0.035 * 46,
    fontVariant: ['tabular-nums'],
  },
  display: {
    fontFamily: InterFont.extrabold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.025 * 34,
  },
  title: {
    fontFamily: InterFont.extrabold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.025 * 28,
  },
  heading: {
    fontFamily: InterFont.bold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.01 * 18,
  },
  subtitle: {
    fontFamily: InterFont.bold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.01 * 18,
  },
  default: {
    fontFamily: InterFont.medium,
    fontSize: 15,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  small: {
    fontFamily: InterFont.regular,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  smallBold: {
    fontFamily: InterFont.bold,
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  overline: {
    fontFamily: InterFont.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.06 * 12,
    textTransform: 'uppercase',
  },
  link: {
    fontFamily: InterFont.semibold,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: InterFont.semibold,
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
