import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** EcoNav app mark: a rounded tile with a route curving from a start dot to a green pin. */
export function BrandMark({ size = 40, tile = '#FFFFFF' }: { size?: number; tile?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" accessibilityLabel="EcoNav">
      <Rect width={80} height={80} rx={20} fill={tile} />
      <Path d="M26 54 C 38 54 38 42 48 38 C 53 36 55 33 56 28" stroke="#14532D" strokeWidth={6} strokeLinecap="round" fill="none" />
      <Circle cx={25} cy={54} r={6} fill="#14532D" />
      <Circle cx={56} cy={27} r={6} fill="#22C55E" />
    </Svg>
  );
}
