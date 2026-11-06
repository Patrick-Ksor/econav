import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

type LocationState =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'granted'; coords: Location.LocationObjectCoords };

export function useCurrentLocation() {
  // Track status, not just coords — so the UI can tell "still loading" apart
  // from "permission denied" and show an actionable message.
  const [state, setState] = useState<LocationState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (active) setState({ status: 'denied' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      if (active) setState({ status: 'granted', coords: pos.coords });
    })();
    return () => {
      active = false; // ignore stale result after unmount
    };
  }, []);

  return state;
}
