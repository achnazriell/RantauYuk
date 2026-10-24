import { useFocusEffect } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Alert, Linking, Text, View } from "react-native";

import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Field,
  IconButton,
  Screen,
  confirmAction,
  errorMessage,
  showError,
  useTheme,
} from "@/components/rantau-kit";
import { initServiceTables } from "@/services/local-database.service";
import { getCurrentLocation } from "@/services/location.service";
import {
  deleteSavedPlace,
  getSavedPlaces,
  savePlace,
  searchPlaces,
  type Place,
  type PlaceSearchResult,
} from "@/services/places.service";

type Tab = "search" | "saved";
type SearchScope = "global" | "nearby";
type Origin = { latitude: number; longitude: number };
type Result = PlaceSearchResult & { distanceKm: number | null };

const RADII = [2, 5, 20];

// Kata kunci dalam bahasa Inggris dipakai karena Nominatim mengenalinya
// sebagai jenis tempat (restaurant, pharmacy, dst).
const CATEGORIES = [
  { label: "Makan", query: "restaurant" },
  { label: "Minimarket", query: "convenience store" },
  { label: "Supermarket", query: "supermarket" },
  { label: "Apotek", query: "pharmacy" },
  { label: "ATM", query: "atm" },
  { label: "Laundry", query: "laundry" },
  { label: "Masjid", query: "masjid" },
];

function distanceKm(a: Origin, b: Origin): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function distanceLabel(km: number | null): string {
  if (km === null) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function openRoute(latitude: number, longitude: number): void {
  Linking.openURL(
    `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
  ).catch(() =>
    Alert.alert(
      "Peta tidak bisa dibuka",
      "Pasang aplikasi peta atau browser, lalu coba lagi.",
    ),
  );
}

function PlaceCard({
  name,
  category,
  address,
  distance,
  onRoute,
  action,
}: {
  name: string;
  category: string | null;
  address: string | null;
  distance: string;
  onRoute: () => void;
  action: ReactNode;
}) {
  const t = useTheme();
  const kind =
    category && category !== "unknown" ? category.replace(/_/g, " ") : "";
  const meta = [kind, distance].filter(Boolean).join(", ");

  return (
    <Card>
      <Text style={{ color: t.text, fontSize: 16, fontWeight: "600" }}>
        {name}
      </Text>
      {meta ? (
        <Text style={{ color: t.muted, fontSize: 13 }}>{meta}</Text>
      ) : null}
      {address ? (
        <Text
          numberOfLines={2}
          style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}
        >
          {address}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Button
          label="Rute"
          icon="navigate-outline"
          variant="soft"
          onPress={onRoute}
          style={{ flex: 1 }}
        />
        {action}
      </View>
    </Card>
  );
}

export default function PlacesScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(5);
  const [scope, setScope] = useState<SearchScope>("global");
  const [results, setResults] = useState<Result[] | null>(null);
  const [lastSearch, setLastSearch] = useState<{
    text: string;
    heading: string;
  } | null>(null);
  const [saved, setSaved] = useState<Place[]>([]);
  const [here, setHere] = useState<Origin | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    try {
      await initServiceTables();
      setSaved(await getSavedPlaces());
    } catch (error) {
      showError(error, "Gagal memuat tempat tersimpan");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [loadSaved]),
  );

  const runSearch = async (
    text: string,
    heading: string,
    km = radius,
    searchScope: SearchScope = scope,
  ) => {
    const q = text.trim();
    if (q.length < 2) {
      Alert.alert("Kata kunci terlalu pendek", "Masukkan minimal 2 karakter.");
      return;
    }

    setLoading(true);
    setLocationNote(null);
    setLastSearch({ text: q, heading });

    try {
      let origin: Origin | null = null;
      try {
        const loc = await getCurrentLocation();
        origin = { latitude: loc.latitude, longitude: loc.longitude };
        setHere(origin);
      } catch (error) {
        setLocationNote(errorMessage(error));
      }

      const found = await searchPlaces(
        q,
        15,
        origin
          ? { ...origin, radiusKm: km, bounded: searchScope === "nearby" }
          : undefined,
      );

      const withDistance: Result[] = found.map((place) => ({
        ...place,
        distanceKm: origin ? distanceKm(origin, place) : null,
      }));
      withDistance.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
      setResults(withDistance);
    } catch (error) {
      showError(error, "Pencarian gagal");
    } finally {
      setLoading(false);
    }
  };

  const changeRadius = (km: number) => {
    setRadius(km);
    if (lastSearch) runSearch(lastSearch.text, lastSearch.heading, km, scope);
  };

  const changeScope = (next: SearchScope) => {
    setScope(next);
    if (lastSearch)
      runSearch(lastSearch.text, lastSearch.heading, radius, next);
  };

  const isSaved = (place: Result) =>
    saved.some(
      (item) =>
        item.name === place.name &&
        Math.abs((item.latitude ?? 0) - place.latitude) < 0.0001 &&
        Math.abs((item.longitude ?? 0) - place.longitude) < 0.0001,
    );

  const save = async (place: Result) => {
    try {
      await savePlace(place);
      await loadSaved();
    } catch (error) {
      showError(error, "Tempat tidak bisa disimpan");
    }
  };

  const remove = (place: Place) =>
    confirmAction(
      "Hapus tempat?",
      `"${place.name}" akan dihapus dari daftar tersimpan.`,
      "Hapus",
      async () => {
        try {
          await deleteSavedPlace(place.id);
          await loadSaved();
        } catch (error) {
          showError(error, "Gagal menghapus");
        }
      },
    );

  return (
    <Screen
      icon="location-outline"
      title="Tempat sekitar"
      subtitle="Temukan warung dan toko di sekitar kamu."
    >
      <ChipRow>
        <Chip
          label="Cari"
          selected={tab === "search"}
          onPress={() => setTab("search")}
        />
        <Chip
          label={`Tersimpan (${saved.length})`}
          selected={tab === "saved"}
          onPress={() => setTab("saved")}
        />
      </ChipRow>

      {tab === "search" ? (
        <>
          <Card>
            <Field
              value={query}
              onChangeText={setQuery}
              placeholder="Cari nama tempat, contoh: warung bakso"
              returnKeyType="search"
              onSubmitEditing={() => runSearch(query, query)}
            />
            <Button
              label="Cari"
              icon="search"
              loading={loading}
              disabled={query.trim().length < 2}
              onPress={() => runSearch(query, query)}
            />

            <Text style={{ color: t.muted, fontSize: 13 }}>Kategori</Text>
            <ChipRow>
              {CATEGORIES.map((category) => (
                <Chip
                  key={category.label}
                  label={category.label}
                  selected={lastSearch?.heading === category.label}
                  onPress={() => {
                    setQuery("");
                    runSearch(category.query, category.label);
                  }}
                />
              ))}
            </ChipRow>

            <Text style={{ color: t.muted, fontSize: 13 }}>
              Cakupan pencarian
            </Text>
            <ChipRow>
              <Chip
                label="Global"
                selected={scope === "global"}
                onPress={() => changeScope("global")}
              />
              <Chip
                label="Sekitar saya"
                selected={scope === "nearby"}
                onPress={() => changeScope("nearby")}
              />
            </ChipRow>
            {scope === "nearby" ? (
              <>
                <Text style={{ color: t.muted, fontSize: 13 }}>
                  Batas area sekitar
                </Text>
                <ChipRow>
                  {RADII.map((km) => (
                    <Chip
                      key={km}
                      label={`${km} km`}
                      selected={radius === km}
                      onPress={() => changeRadius(km)}
                    />
                  ))}
                </ChipRow>
              </>
            ) : null}
          </Card>

          {locationNote ? (
            <>
              <Banner tone="warn">
                {`${locationNote} Pencarian dilakukan tanpa lokasi, jadi hasil bisa jauh dari kamu.`}
              </Banner>
              <Button
                label="Buka pengaturan"
                variant="ghost"
                icon="settings-outline"
                onPress={() => Linking.openSettings()}
              />
            </>
          ) : null}

          {results === null ? (
            <EmptyState
              icon="location-outline"
              title="Cari yang kamu butuhkan"
              hint="Pilih kategori atau ketik nama tempat. Hasil diurutkan dari yang terdekat."
            />
          ) : results.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="Tidak ada hasil"
              hint="Coba perbesar jarak pencarian atau pakai kata kunci lain. Data berasal dari OpenStreetMap, jadi tempat kecil mungkin belum terdaftar."
            />
          ) : (
            results.map((place, index) => {
              const already = isSaved(place);
              return (
                <PlaceCard
                  key={`${place.latitude},${place.longitude},${index}`}
                  name={place.name}
                  category={place.category}
                  address={place.address}
                  distance={distanceLabel(place.distanceKm)}
                  onRoute={() => openRoute(place.latitude, place.longitude)}
                  action={
                    <Button
                      label={already ? "Tersimpan" : "Simpan"}
                      icon={already ? "bookmark" : "bookmark-outline"}
                      variant="ghost"
                      disabled={already}
                      onPress={() => save(place)}
                      style={{ flex: 1 }}
                    />
                  }
                />
              );
            })
          )}
        </>
      ) : saved.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="Belum ada tempat tersimpan"
          hint="Simpan warung langganan atau toko yang sering kamu butuhkan dari hasil pencarian."
        />
      ) : (
        saved.map((place) => (
          <PlaceCard
            key={place.id}
            name={place.name}
            category={place.category}
            address={place.address}
            distance={
              here && place.latitude !== null && place.longitude !== null
                ? distanceLabel(
                    distanceKm(here, {
                      latitude: place.latitude,
                      longitude: place.longitude,
                    }),
                  )
                : ""
            }
            onRoute={() => {
              if (place.latitude !== null && place.longitude !== null) {
                openRoute(place.latitude, place.longitude);
              }
            }}
            action={
              <IconButton
                icon="trash-outline"
                label={`Hapus ${place.name}`}
                onPress={() => remove(place)}
              />
            }
          />
        ))
      )}
    </Screen>
  );
}
