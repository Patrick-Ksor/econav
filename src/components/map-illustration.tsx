import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { InterFont, PhoneColumnWidth, RouteColors } from '@/constants/theme';
import { pointAt, projectRoutes, thin, toPath } from '@/lib/map-projection';
import { LatLng } from '@/schemas/routing';

export type MapTone = 'light' | 'dark' | 'forest';

export interface MapRoute {
  id: string;
  color: string;
  points: LatLng[];
  selected?: boolean;
  /** Pill drawn on the route, e.g. "$7.50 · 33 min". */
  label?: string;
}

// Palettes ported from the design's Map component.
const PALETTE = {
  light: { bg: '#E8EEE8', water: '#CCDFEC', park: '#D2E5CF', minor: '#FFFFFF', major: '#FFFFFF', majorEdge: '#D3DBD3', hwy: '#FBE3B3', hwyEdge: '#E9C98C', casing: '#FFFFFF', pin: '#14532D', dot: '#0F172A' },
  dark: { bg: '#0D1613', water: '#0F2233', park: '#13261C', minor: '#1A2622', major: '#24332D', majorEdge: '#1A2622', hwy: '#3B3222', hwyEdge: '#2C261A', casing: '#0D1613', pin: '#22C55E', dot: '#F1F5F9' },
  forest: { bg: '#14532D', water: '#104526', park: '#18603A', minor: '#1B6337', major: '#22713F', majorEdge: '#175A31', hwy: '#2A7D47', hwyEdge: '#1E6B3A', casing: '#14532D', pin: '#22C55E', dot: '#FFFFFF' },
} as const;

const VIEW_W = 390;
const VIEW_H = 300;
// Where routes are allowed to sit, leaving room for floating bars above and the sheet below.
const ROUTE_RECT = { x0: 48, y0: 78, x1: 342, y1: 248 };
const BLUE = '#2563EB';
const DEMO_ROUTE = 'M64 246H100V160H200V90H290L318 58';

interface MapIllustrationProps {
  height: number;
  tone?: MapTone;
  routes?: MapRoute[];
  /** Blue "you are here" dot in the middle, for map cards without routes. */
  centerDot?: boolean;
  /** Decorative sample route (Welcome screen) instead of real geometry. */
  demoRoute?: boolean;
  accessibilityLabel?: string;
}

/**
 * Stylized tile map from the design system. It isn't a real basemap: streets, parks and
 * water are decoration, but any `routes` passed in are the real route geometry, fitted
 * onto it with a shared scale so their shapes and relative positions are true.
 */
export function MapIllustration({ height, tone, routes = [], centerDot, demoRoute, accessibilityLabel }: MapIllustrationProps) {
  const scheme = useColorScheme();
  const c = PALETTE[tone ?? (scheme === 'dark' ? 'dark' : 'light')];
  const dark = (tone ?? (scheme === 'dark' ? 'dark' : 'light')) !== 'light';

  const drawn = useMemo(() => {
    const thinned = routes.map((r) => thin(r.points));
    const projected = projectRoutes(thinned, ROUTE_RECT);
    return routes.map((r, i) => ({ route: r, pts: projected[i] })).filter((d) => d.pts.length > 1);
  }, [routes]);

  // Selected route is painted last so it sits on top.
  const ordered = [...drawn].sort((a, b) => Number(!!a.route.selected) - Number(!!b.route.selected));
  const first = drawn[0]?.pts;
  const origin = first?.[0];
  const dest = first?.[first.length - 1];
  const anySelected = drawn.some((d) => d.route.selected);

  return (
    <View style={{ height, overflow: 'hidden', backgroundColor: c.bg, alignItems: 'center' }}>
      {/* The art is drawn for a phone-width canvas; on wider screens (web, tablets) cap it
          instead of letting 'slice' scale everything up. */}
      <Svg
        width="100%"
        height="100%"
        style={{ maxWidth: PhoneColumnWidth }}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
        accessibilityLabel={accessibilityLabel ?? 'Map of the area'}>
        <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={c.bg} />
        <Path d="M352 -10 C330 50 372 110 350 170 C332 222 366 262 350 310 L400 310 L400 -10 Z" fill={c.water} />
        <G fill="none" stroke={c.minor} strokeWidth={5} strokeLinecap="round">
          <Path d="M30 0V300M64 0V300M100 0V300M200 0V300M250 0V300M290 0V300" />
          <Path d="M0 28H340M0 58H340M0 90H340M0 120H340M0 160H340M0 230H340M0 246H340" />
        </G>
        <Rect x={8} y={132} width={50} height={20} rx={6} fill={c.park} />
        <Rect x={160} y={208} width={34} height={16} rx={6} fill={c.park} />
        <Rect x={206} y={32} width={38} height={20} rx={6} fill={c.park} />
        <Rect x={106} y={94} width={38} height={22} rx={6} fill={c.park} />
        <G fill="none" strokeLinecap="round">
          <Path d="M0 200H344M150 0V300" stroke={c.majorEdge} strokeWidth={11} />
          <Path d="M0 200H344M150 0V300" stroke={c.major} strokeWidth={8} />
          <Path d="M0 262H200Q300 266 332 200V0" stroke={c.hwyEdge} strokeWidth={14} />
          <Path d="M0 262H200Q300 266 332 200V0" stroke={c.hwy} strokeWidth={10} />
        </G>

        <G fill="none" strokeLinecap="round" strokeLinejoin="round">
          {ordered.map(({ route, pts }) => {
            const d = toPath(pts);
            const on = route.selected || !anySelected;
            return (
              <G key={route.id} opacity={on ? 1 : 0.55}>
                <Path d={d} stroke={c.casing} strokeWidth={route.selected ? 12 : 10} />
                <Path d={d} stroke={route.color} strokeWidth={route.selected ? 8 : 6} />
              </G>
            );
          })}
        </G>

        {drawn.map(({ route, pts }, i) => {
          if (!route.label) return null;
          const w = route.label.length * 6.3 + 20;
          const at = pointAt(pts, route.selected ? 0.5 : 0.28 + 0.4 * (i % 2));
          const x = Math.min(VIEW_W - w / 2 - 6, Math.max(w / 2 + 6, at.x));
          const y = Math.min(VIEW_H - 18, Math.max(16, at.y));
          const filled = !!route.selected;
          return (
            <G key={`${route.id}-label`}>
              <Rect
                x={x - w / 2}
                y={y - 12}
                width={w}
                height={24}
                rx={12}
                fill={filled ? route.color : dark ? '#121C18' : '#FFFFFF'}
                stroke={filled ? 'none' : route.color}
                strokeWidth={1.5}
              />
              <SvgText
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize={11}
                fontFamily={InterFont.bold}
                fontWeight="700"
                fill={filled ? (dark ? '#052E16' : '#FFFFFF') : dark ? '#F1F5F9' : '#0F172A'}>
                {route.label}
              </SvgText>
            </G>
          );
        })}

        {demoRoute && (
          <G>
            <G fill="none" strokeLinecap="round" strokeLinejoin="round">
              <Path d={DEMO_ROUTE} stroke={c.casing} strokeWidth={13} />
              <Path d={DEMO_ROUTE} stroke={dark ? '#22C55E' : RouteColors.balanced} strokeWidth={9} />
            </G>
            <Circle cx={64} cy={246} r={14} fill={c.dot} opacity={0.15} />
            <Circle cx={64} cy={246} r={8} fill="#FFFFFF" />
            <Circle cx={64} cy={246} r={5} fill={c.dot} />
            <Circle cx={318} cy={58} r={12} fill={c.pin} stroke="#FFFFFF" strokeWidth={3} />
            <Circle cx={318} cy={58} r={4} fill="#FFFFFF" />
          </G>
        )}

        {origin && (
          <G>
            <Circle cx={origin.x} cy={origin.y} r={14} fill={c.dot} opacity={0.15} />
            <Circle cx={origin.x} cy={origin.y} r={8} fill="#FFFFFF" />
            <Circle cx={origin.x} cy={origin.y} r={5} fill={c.dot} />
          </G>
        )}
        {dest && (
          <G>
            <Circle cx={dest.x} cy={dest.y} r={12} fill={c.pin} stroke="#FFFFFF" strokeWidth={3} />
            <Circle cx={dest.x} cy={dest.y} r={4} fill="#FFFFFF" />
          </G>
        )}

        {centerDot && (
          <G>
            <Circle cx={195} cy={150} r={20} fill={BLUE} opacity={0.18} />
            <Circle cx={195} cy={150} r={7} fill={BLUE} stroke="#FFFFFF" strokeWidth={3} />
          </G>
        )}
      </Svg>
    </View>
  );
}

