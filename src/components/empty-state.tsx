import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { InterFont, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { PrimaryButton } from './primary-button';
import { ThemedText } from './themed-text';

interface EmptyStateProps {
  illustration: ReactNode;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  /** Extra content under the primary button, e.g. a secondary action. */
  footer?: ReactNode;
}

/** Centered illustration, title and explanation, with the action pinned to the bottom. */
export function EmptyState({ illustration, title, body, actionLabel, onAction, footer }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <View style={styles.center}>
        {illustration}
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText style={styles.body} themeColor="textSecondary">
          {body}
        </ThemedText>
      </View>
      <View style={styles.actions}>
        <PrimaryButton label={actionLabel} onPress={onAction} />
        {footer}
      </View>
    </View>
  );
}

/** Rounded icon tile used as the illustration for most empty states. */
export function IconTile({
  icon,
  tone = 'brand',
}: {
  icon: SymbolViewProps['name'];
  tone?: 'brand' | 'danger';
}) {
  const theme = useTheme();
  const danger = tone === 'danger';
  return (
    <View
      style={[
        styles.tile,
        danger ? { backgroundColor: theme.warnBg, borderRadius: 48 } : { backgroundColor: theme.tintBg },
      ]}>
      <SymbolView name={icon} size={40} tintColor={danger ? theme.danger : theme.brand} />
    </View>
  );
}

/** Three dashed placeholder rows, standing in for a list that has nothing in it yet. */
export function DashedRows() {
  const theme = useTheme();
  return (
    <View style={styles.dashedStack}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.dashed, { borderColor: theme.border }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 12 },
  title: { fontFamily: InterFont.extrabold, fontSize: 22, lineHeight: 27, textAlign: 'center', marginTop: 12 },
  body: { fontFamily: InterFont.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  actions: { gap: 8 },
  tile: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  dashedStack: { width: 250, gap: 12 },
  dashed: { height: 60, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
});
