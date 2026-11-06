import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { MapIllustration } from '@/components/map-illustration';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { InterFont, PhoneColumnWidth, RouteColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

// Sample figures for the illustrations only; nothing here is the user's data.
const STEPS = [
  { title: 'Every Mile. Smarter.', body: 'Find routes that balance fuel costs, time, and vehicle wear. Drive smarter and track your savings.', cta: 'Get Started' },
  { title: 'Add your vehicle', body: "Your car's fuel economy and wear set the real cost of every mile. Search your model and we'll fill in the rest.", cta: 'Next' },
  { title: 'Compare money and time', body: "See fuel and wear for every route side by side, then pick the one that's worth it to you.", cta: 'Next' },
  { title: 'Track your savings', body: "Confirm trips when you're back and watch your estimated savings add up against the fastest route.", cta: 'Create account' },
] as const;

const LAST = STEPS.length - 1;

/** Welcome plus three intro pages, shown to signed-out users before sign-in. */
export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toSignIn = () => router.replace('/sign-in');
  const next = () => (step === LAST ? toSignIn() : setStep(step + 1));

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.column}>
        {step === 0 ? <WelcomeHero /> : null}

        {step > 0 && (
          <>
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(step - 1)} style={styles.back}>
                <SymbolView
                  name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                  size={24}
                  tintColor={theme.text}
                />
              </Pressable>
              {step < LAST && (
                <Pressable accessibilityRole="button" onPress={toSignIn} style={styles.skip}>
                  <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>Skip</ThemedText>
                </Pressable>
              )}
            </View>

            <View style={styles.stage}>
              <View style={[styles.halo, { backgroundColor: theme.tintBg }]} />
              {step === 1 && <VehicleIllustration />}
              {step === 2 && <CompareIllustration />}
              {step === 3 && <SavingsIllustration />}
            </View>
          </>
        )}

        <View
          style={[
            styles.sheet,
            step === 0 && [styles.sheetOverlay, { backgroundColor: theme.surfaceRaised }],
            { paddingBottom: 28 + insets.bottom },
          ]}>
          <Dots active={step} />
          <ThemedText style={styles.title}>{STEPS[step].title}</ThemedText>
          <ThemedText style={[styles.body, { color: theme.textSecondary }]}>{STEPS[step].body}</ThemedText>
          <View style={styles.actions}>
            <PrimaryButton label={STEPS[step].cta} onPress={next} />
            {step === 0 && (
              <Pressable accessibilityRole="button" onPress={toSignIn} style={styles.link}>
                <ThemedText style={[styles.linkText, { color: theme.brand }]}>I already have an account</ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </ThemedView>
  );
}

function Dots({ active }: { active: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dots} accessibilityLabel={`Step ${active + 1} of ${STEPS.length}`}>
      {STEPS.map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === active ? { width: 22, backgroundColor: theme.brandFill } : { width: 6, backgroundColor: theme.border },
          ]}
        />
      ))}
    </View>
  );
}

function WelcomeHero() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <>
      <View style={[StyleSheet.absoluteFill, { bottom: undefined }]}>
        <MapIllustration height={height * 0.62} tone="forest" demoRoute accessibilityLabel="Map with a sample route" />
      </View>
      <View style={[styles.brand, { top: insets.top + 24 }]}>
        <BrandMark size={40} />
        <ThemedText style={styles.brandName}>EcoNav</ThemedText>
      </View>
      <View style={[styles.routeCard, { top: insets.top + 160 }]}>
        <View style={styles.routeCardHead}>
          <View style={[styles.routeDot, { backgroundColor: RouteColors.balanced }]} />
          <ThemedText style={styles.routeCardLabel}>Efficient route</ThemedText>
        </View>
        <View style={styles.routeCardMain}>
          <ThemedText style={styles.routeCardPrice}>$7.50</ThemedText>
          <ThemedText style={styles.routeCardTime}>33 min</ThemedText>
        </View>
        <ThemedText style={styles.routeCardNote}>Est. $4.05 less than fastest</ThemedText>
      </View>
    </>
  );
}

function IllustrationCard({ children, width = 274 }: { children: ReactNode; width?: number }) {
  const theme = useTheme();
  const shadow = useColorScheme() === 'dark' ? '0 18px 40px rgba(0,0,0,0.4)' : '0 18px 40px rgba(15,23,42,0.10)';
  return (
    <View style={[styles.illCard, { width, backgroundColor: theme.surfaceRaised, borderColor: theme.border, boxShadow: shadow }]}>
      {children}
    </View>
  );
}

function VehicleIllustration() {
  const theme = useTheme();
  return (
    <IllustrationCard>
      <View style={styles.vehicleHead}>
        <View style={[styles.vehicleIcon, { backgroundColor: theme.backgroundElement }]}>
          <SymbolView
            name={{ ios: 'car.fill', android: 'directions_car', web: 'directions_car' }}
            size={26}
            tintColor={theme.brand}
          />
        </View>
        <View style={{ gap: 2 }}>
          <ThemedText style={styles.vehicleYear} themeColor="textSecondary">
            2021 Toyota
          </ThemedText>
          <ThemedText style={styles.vehicleModel}>RAV4 XLE</ThemedText>
        </View>
      </View>
      <View style={styles.tileRow}>
        <MiniTile label="Combined" value="30 MPG" />
        <MiniTile label="Wear" value="$0.18/mi" />
      </View>
      <View style={[styles.cpm, { borderTopColor: theme.border }]}>
        <ThemedText style={styles.cpmLabel} themeColor="textSecondary">
          Cost per mile
        </ThemedText>
        <ThemedText style={[styles.cpmValue, { color: theme.success }]}>$0.29</ThemedText>
      </View>
    </IllustrationCard>
  );
}

function MiniTile({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.miniTile, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.miniLabel} themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.miniValue}>{value}</ThemedText>
    </View>
  );
}

function CompareIllustration() {
  const theme = useTheme();
  const rows = [
    { label: 'Efficient', color: RouteColors.balanced, time: '33 min', cost: '$7.50', rec: true },
    { label: 'Fastest', color: RouteColors.fastest, time: '29 min', cost: '$11.55', rec: false },
  ];
  return (
    <View style={styles.compareStack}>
      {rows.map((r) => (
        <View
          key={r.label}
          style={[
            styles.compareRow,
            {
              backgroundColor: theme.surfaceRaised,
              borderColor: r.rec ? theme.brand : theme.border,
              borderWidth: r.rec ? 2 : 1,
            },
          ]}>
          <View style={styles.compareMain}>
            <View style={[styles.routeDot, { backgroundColor: r.color }]} />
            <ThemedText style={styles.compareLabel}>{r.label}</ThemedText>
            <ThemedText style={styles.compareTime} themeColor="textSecondary">
              {r.time}
            </ThemedText>
            <ThemedText style={[styles.compareCost, r.rec && { color: theme.brand }]}>{r.cost}</ThemedText>
          </View>
          {r.rec && (
            <View style={[styles.recBadge, { backgroundColor: theme.tintBg }]}>
              <ThemedText style={[styles.recText, { color: theme.brand }]}>Recommended for you</ThemedText>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function SavingsIllustration() {
  const bars = [28, 40, 48, 34, 84, 76];
  return (
    <View style={[styles.savingsCard]}>
      <ThemedText style={styles.savingsLabel}>Total estimated savings</ThemedText>
      <ThemedText type="moneyXl" style={styles.savingsMoney}>
        $128.45
      </ThemedText>
      <View style={styles.bars}>
        {bars.map((h, i) => (
          <View
            key={i}
            style={[styles.bar, { height: h, backgroundColor: i === bars.length - 1 ? '#22C55E' : '#1A9446' }]}
          />
        ))}
      </View>
      <View style={styles.savingsFoot}>
        <ThemedText style={styles.savingsFootText}>26 trips</ThemedText>
        <ThemedText style={styles.savingsFootText}>8.4 gal fuel avoided</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: PhoneColumnWidth },

  brand: { position: 'absolute', left: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandName: { fontFamily: InterFont.extrabold, fontSize: 24, color: '#FFFFFF', letterSpacing: -0.02 * 24 },
  routeCard: {
    position: 'absolute',
    left: '34%',
    width: 214,
    gap: 4,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 14px 34px rgba(0,0,0,0.28)',
  },
  routeCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeCardLabel: { fontFamily: InterFont.semibold, fontSize: 13, color: '#14532D' },
  routeCardMain: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  routeCardPrice: { fontFamily: InterFont.extrabold, fontSize: 28, color: '#0F172A', letterSpacing: -0.025 * 28 },
  routeCardTime: { fontFamily: InterFont.medium, fontSize: 13, color: '#64748B' },
  routeCardNote: { fontFamily: InterFont.semibold, fontSize: 13, color: '#15803D' },
  routeDot: { width: 12, height: 12, borderRadius: 6 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  skipText: { fontFamily: InterFont.semibold, fontSize: 16 },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.55 },

  sheet: { gap: 12, paddingHorizontal: 24, paddingTop: 4 },
  sheetOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 28,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 12, marginBottom: 4 },
  dot: { height: 6, borderRadius: 3 },
  title: { fontFamily: InterFont.extrabold, fontSize: 34, lineHeight: 38, letterSpacing: -0.025 * 34 },
  body: { fontFamily: InterFont.regular, fontSize: 17, lineHeight: 25, marginBottom: 12 },
  actions: { gap: 4 },
  link: { height: 52, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontFamily: InterFont.semibold, fontSize: 16 },

  illCard: { gap: 14, padding: 18, borderRadius: 24, borderWidth: 1 },
  vehicleHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  vehicleIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  vehicleYear: { fontFamily: InterFont.medium, fontSize: 13 },
  vehicleModel: { fontFamily: InterFont.extrabold, fontSize: 20, letterSpacing: -0.01 * 20 },
  tileRow: { flexDirection: 'row', gap: 8 },
  miniTile: { flex: 1, gap: 2, padding: 10, borderRadius: 12 },
  miniLabel: { fontFamily: InterFont.medium, fontSize: 12 },
  miniValue: { fontFamily: InterFont.extrabold, fontSize: 17 },
  cpm: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1 },
  cpmLabel: { fontFamily: InterFont.medium, fontSize: 14 },
  cpmValue: { fontFamily: InterFont.extrabold, fontSize: 20 },

  compareStack: { gap: 10, width: 286 },
  compareRow: { gap: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18 },
  compareMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compareLabel: { flex: 1, fontFamily: InterFont.bold, fontSize: 16 },
  compareTime: { fontFamily: InterFont.medium, fontSize: 13 },
  compareCost: { fontFamily: InterFont.extrabold, fontSize: 18, fontVariant: ['tabular-nums'] },
  recBadge: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, marginLeft: 22 },
  recText: { fontFamily: InterFont.bold, fontSize: 11 },

  savingsCard: {
    width: 270,
    gap: 6,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#14532D',
    boxShadow: '0 18px 40px rgba(20,83,45,0.35)',
  },
  savingsLabel: { fontFamily: InterFont.semibold, fontSize: 13, color: '#BBF7D0' },
  savingsMoney: { color: '#FFFFFF', fontSize: 36, lineHeight: 40 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 90, marginTop: 14 },
  bar: { flex: 1, borderRadius: 6 },
  savingsFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  savingsFootText: { fontFamily: InterFont.medium, fontSize: 13, color: '#BBF7D0' },
});
