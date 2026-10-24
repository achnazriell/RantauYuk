import * as Location from "expo-location";
import { getLocalDatabase, initServiceTables } from "./local-database.service";

export interface Place {
  id: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  created_at: string;
}

export interface PlaceSearchResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
}

export async function getCurrentCoordinates(): Promise<{
  latitude: number;
  longitude: number;
}> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error("Izin lokasi tidak diberikan.");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest,
    mayShowUserSettingsDialog: true,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}

export interface SearchOrigin {
  latitude: number;
  longitude: number;
  /** Radius yang digunakan sebagai petunjuk pengurutan, bukan batas global. */
  radiusKm?: number;
  /** Set true hanya jika memang ingin membatasi hasil ke area sekitar. */
  bounded?: boolean;
}

export async function searchPlaces(
  query: string,
  limit = 10,
  near?: SearchOrigin,
): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    throw new Error("Masukkan minimal 2 karakter untuk mencari tempat.");
  }

  const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const params: Record<string, string> = {
    q: trimmed,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(safeLimit),
  };

  // Batasi pencarian ke kotak di sekitar lokasi pengguna.
  if (near) {
    const radiusKm = Math.max(0.5, Math.min(50, near.radiusKm ?? 5));
    const dLat = radiusKm / 111;
    const dLon =
      radiusKm /
      (111 * Math.max(0.1, Math.cos((near.latitude * Math.PI) / 180)));

    params.viewbox = [
      near.longitude - dLon,
      near.latitude + dLat,
      near.longitude + dLon,
      near.latitude - dLat,
    ].join(",");
    // Viewbox menjadi preferensi lokasi, bukan batas keras, agar pencarian
    // tetap bisa menemukan tempat di kota/negara lain jika relevan.
    if (near.bounded) params.bounded = "1";
  }

  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams(params).toString();

  // Nominatim mewajibkan User-Agent yang mengidentifikasi aplikasi.
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "id,en",
      "User-Agent": "RantauYuk/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("Pencarian tempat gagal. Coba lagi nanti.");
  }

  const data = await response.json();

  return (
    data as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
      name?: string;
      type?: string;
      class?: string;
    }>
  )
    .map((item) => ({
      name: item.name || item.display_name?.split(",")[0] || "Tempat",
      address: item.display_name || "",
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      category: item.type || item.class || "unknown",
    }))
    .filter(
      (item) =>
        Number.isFinite(item.latitude) && Number.isFinite(item.longitude),
    );
}

export async function savePlace(place: PlaceSearchResult): Promise<number> {
  if (!place.name.trim()) throw new Error("Nama tempat wajib diisi.");

  await initServiceTables();
  const db = await getLocalDatabase();

  const result = await db.runAsync(
    `INSERT INTO saved_places
      (name, address, latitude, longitude, category, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    place.name.trim(),
    place.address || null,
    place.latitude,
    place.longitude,
    place.category || null,
    new Date().toISOString(),
  );

  return result.lastInsertRowId;
}

export async function getSavedPlaces(): Promise<Place[]> {
  await initServiceTables();
  const db = await getLocalDatabase();

  return db.getAllAsync<Place>(
    "SELECT * FROM saved_places ORDER BY created_at DESC",
  );
}

export async function deleteSavedPlace(id: number): Promise<void> {
  await initServiceTables();
  const db = await getLocalDatabase();
  await db.runAsync("DELETE FROM saved_places WHERE id = ?", id);
}
