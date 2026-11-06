import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { LatLng } from '@/schemas/routing';

export type ExternalMapApp = 'google' | 'apple' | 'waze';

export interface LaunchParams {
  origin?: LatLng; // omit to let the target app use device location (Waze always does)
  destination: LatLng;
  // Intermediate points sampled from our computed route, used only by Google Maps
  // (see below) to bias it toward the same path instead of letting it pick its own.
  waypoints?: LatLng[];
}

const fmt = (p: LatLng) => `${p.lat},${p.lng}`;

export async function openInExternalMap(
  app: ExternalMapApp,
  { origin, destination, waypoints }: LaunchParams,
): Promise<void> {
  switch (app) {
    case 'google': {
      // The native `comgooglemaps://` app scheme has no waypoints support at all
      // (confirmed against Google's own URL scheme docs — only saddr/daddr/
      // directionsmode). The `https://www.google.com/maps/dir/?api=1...` web URL
      // supports waypoints AND is documented by Google to work as a Universal Link
      // on iOS — it opens directly in the installed Google Maps app, same as the
      // custom scheme would, so there's no tradeoff to using it everywhere.
      const waypointsParam =
        waypoints && waypoints.length > 0
          ? `&waypoints=${waypoints.map(fmt).join('|')}`
          : '';
      const webUrl = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${fmt(origin)}` : ''}&destination=${fmt(destination)}&travelmode=driving${waypointsParam}`;
      await Linking.openURL(webUrl);
      break;
    }
    case 'apple': {
      // Universal link — always openable on iOS, no canOpenURL/scheme check needed.
      const url = `https://maps.apple.com/?${origin ? `saddr=${fmt(origin)}&` : ''}daddr=${fmt(destination)}&dirflg=d`;
      await Linking.openURL(url);
      break;
    }
    case 'waze': {
      // Waze always navigates from the device's current location — no origin param exists.
      const appUrl = `waze://?ll=${fmt(destination)}&navigate=yes`;
      const webUrl = `https://waze.com/ul?ll=${fmt(destination)}&navigate=yes`;
      if (Platform.OS !== 'web' && (await Linking.canOpenURL(appUrl))) {
        await Linking.openURL(appUrl);
      } else {
        await Linking.openURL(webUrl);
      }
      break;
    }
  }
}

export function isAppleMapsAvailable(): boolean {
  return Platform.OS === 'ios';
}
