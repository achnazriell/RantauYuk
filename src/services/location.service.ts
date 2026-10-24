import * as Location from "expo-location";

export interface CurrentLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export async function requestLocationPermission(): Promise<boolean> {
  const result = await Location.requestForegroundPermissionsAsync();
  return result.status === "granted";
}

/**
 * Mengutamakan fix GPS baru dan akurat. Posisi terakhir hanya digunakan
 * sebagai fallback bila GPS gagal, dan hanya jika kualitasnya masih wajar.
 */
export async function getCurrentLocation(): Promise<CurrentLocation> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error("Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan.");
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      mayShowUserSettingsDialog: true,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    };
  } catch (error) {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: 2 * 60 * 1000,
      requiredAccuracy: 150,
    }).catch(() => null);

    if (last) {
      return {
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
        accuracy: last.coords.accuracy,
        timestamp: last.timestamp,
      };
    }
    throw new Error(
      "GPS belum mendapatkan posisi. Aktifkan GPS dan coba di area terbuka.",
    );
  }
}

export async function getCurrentAddress(): Promise<string | null> {
  const location = await getCurrentLocation();
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    const address = addresses[0];
    if (!address) return null;
    return (
      [
        address.name,
        address.street,
        address.district,
        address.subregion,
        address.city,
        address.region,
        address.postalCode,
        address.country,
      ]
        .filter(Boolean)
        .filter((value, index, all) => all.indexOf(value) === index)
        .join(", ") || null
    );
  } catch {
    return null;
  }
}

export async function openLocationSettings(): Promise<void> {
  await Location.enableNetworkProviderAsync().catch(() => undefined);
}

export async function getCurrentCity(): Promise<string | null> {
  const location = await getCurrentLocation();
  try {
    const [address] = await Location.reverseGeocodeAsync({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    const raw = address?.city ?? address?.subregion ?? address?.region ?? null;
    if (!raw) return null;
    return raw.replace(/^(kabupaten|kab\.|kota)\s+/i, "").trim() || null;
  } catch {
    return null;
  }
}
