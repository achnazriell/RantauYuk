import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Stack } from "expo-router";

type Product = {
  product_name?: string;
  brands?: string;
  nutriments?: {
    "energy-kcal_100g"?: number | string;
    proteins_100g?: number | string;
    carbohydrates_100g?: number | string;
    fat_100g?: number | string;
    fiber_100g?: number | string;
    sugars_100g?: number | string;
    salt_100g?: number | string;
  };
};

type NutritionResult = {
  name: string;
  brand: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugars: number | null;
  salt: number | null;
};

function numberOrNull(value: number | string | undefined): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseProduct(product: Product): NutritionResult {
  const n = product.nutriments ?? {};
  return {
    name: product.product_name || "Produk tanpa nama",
    brand: product.brands || "Merek tidak tersedia",
    calories: numberOrNull(n["energy-kcal_100g"]),
    protein: numberOrNull(n.proteins_100g),
    carbs: numberOrNull(n.carbohydrates_100g),
    fat: numberOrNull(n.fat_100g),
    fiber: numberOrNull(n.fiber_100g),
    sugars: numberOrNull(n.sugars_100g),
    salt: numberOrNull(n.salt_100g),
  };
}

function nutrientLabel(value: number | null, unit: string) {
  return value === null ? "Tidak tersedia" : `${value.toFixed(1)} ${unit}`;
}

export default function NutritionScreen() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [foodName, setFoodName] = useState("");
  const [result, setResult] = useState<NutritionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Izin kamera diperlukan",
        "Izinkan Rantau Yuk mengakses kamera untuk memotret makanan.",
      );
      return;
    }
    const captured = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!captured.canceled && captured.assets[0]) {
      setPhoto(captured.assets[0].uri);
      setResult(null);
      setNotice(
        "Foto tersimpan. Masukkan nama makanan/produk agar data gizi dapat dicari.",
      );
    }
  };

  const choosePhoto = async () => {
    const selected = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!selected.canceled && selected.assets[0]) {
      setPhoto(selected.assets[0].uri);
      setResult(null);
      setNotice(
        "Foto dipilih. Masukkan nama makanan/produk untuk mencari informasi gizi.",
      );
    }
  };

  const searchNutrition = async () => {
    const term = foodName.trim();
    if (term.length < 2) {
      Alert.alert(
        "Nama makanan diperlukan",
        "Isi nama makanan atau produk yang terlihat di foto.",
      );
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setResult(null);
    setNotice(null);
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=8`;
      const response = await fetch(url, {
        headers: { Accept: "application/json", "Accept-Language": "id,en" },
      });
      if (!response.ok)
        throw new Error("Layanan data gizi tidak merespons. Coba lagi.");
      const data = (await response.json()) as { products?: Product[] };
      const product = (data.products ?? []).find(
        (item) =>
          item.nutriments &&
          (item.nutriments["energy-kcal_100g"] !== undefined ||
            item.nutriments.proteins_100g !== undefined ||
            item.nutriments.carbohydrates_100g !== undefined),
      );
      if (!product) {
        setNotice(
          "Data gizi yang cocok tidak ditemukan. Coba nama produk yang lebih spesifik. Untuk makanan rumahan, hasil database mungkin terbatas.",
        );
        return;
      }
      setResult(parseProduct(product));
      setNotice(
        "Data berasal dari Open Food Facts dan umumnya dihitung per 100 g produk. Cocokkan nama dan merek dengan produk di foto.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Gagal mencari data gizi.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Cek Gizi Makanan" }} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>RANTAU YUK • NUTRISI</Text>
          <Text style={styles.title}>Cek gizi makanan</Text>
          <Text style={styles.subtitle}>
            Foto makanan, lalu cari data gizi produk. Hasil saat ini berdasarkan
            nama yang kamu masukkan, bukan pengenalan otomatis dari foto.
          </Text>
        </View>

        <View style={styles.panel}>
          {photo ? (
            <Image
              source={{ uri: photo }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.placeholderTitle}>Ambil foto makanan</Text>
              <Text style={styles.muted}>
                Foto kemasan atau hidangan dengan pencahayaan yang cukup.
              </Text>
            </View>
          )}
          <View style={styles.buttonRow}>
            <Pressable style={styles.primaryButton} onPress={takePhoto}>
              <Text style={styles.primaryText}>Buka kamera</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={choosePhoto}>
              <Text style={styles.secondaryText}>Pilih galeri</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>Nama makanan / produk</Text>
          <TextInput
            value={foodName}
            onChangeText={setFoodName}
            placeholder="Contoh: nasi goreng, susu UHT..."
            placeholderTextColor="#8994A5"
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={searchNutrition}
          />
          <Pressable
            style={[styles.primaryButton, styles.searchButton]}
            onPress={searchNutrition}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>Cari informasi gizi</Text>
            )}
          </Pressable>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {result ? (
          <View style={styles.panel}>
            <Text style={styles.resultTitle}>{result.name}</Text>
            <Text style={styles.muted}>{result.brand}</Text>
            <Text style={styles.per100}>Informasi per 100 g</Text>
            <View style={styles.nutrients}>
              <Nutrient
                label="Energi"
                value={nutrientLabel(result.calories, "kkal")}
              />
              <Nutrient
                label="Protein"
                value={nutrientLabel(result.protein, "g")}
              />
              <Nutrient
                label="Karbohidrat"
                value={nutrientLabel(result.carbs, "g")}
              />
              <Nutrient label="Lemak" value={nutrientLabel(result.fat, "g")} />
              <Nutrient
                label="Serat"
                value={nutrientLabel(result.fiber, "g")}
              />
              <Nutrient
                label="Gula"
                value={nutrientLabel(result.sugars, "g")}
              />
              <Nutrient label="Garam" value={nutrientLabel(result.salt, "g")} />
            </View>
            <Text style={styles.disclaimer}>
              Nilai dapat berbeda menurut resep, merek, ukuran porsi, dan
              kelengkapan database. Untuk makanan rumahan, ini bukan analisis
              otomatis dari foto.
            </Text>
          </View>
        ) : null}
        <Text style={styles.footer}>
          Sumber data produk: Open Food Facts. Informasi nutrisi bersifat
          perkiraan dan bukan pengganti saran ahli gizi.
        </Text>
      </ScrollView>
    </>
  );
}

function Nutrient({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.nutrient}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={styles.nutrientValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingBottom: 36,
    gap: 14,
    backgroundColor: "#F5F7FB",
    flexGrow: 1,
  },
  hero: { backgroundColor: "#123D35", padding: 22, borderRadius: 22, gap: 8 },
  eyebrow: {
    color: "#B8E4D3",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#E1EEE9", fontSize: 14, lineHeight: 21 },
  panel: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E4E9EF",
  },
  photo: {
    width: "100%",
    height: 230,
    borderRadius: 14,
    backgroundColor: "#EEF2F6",
  },
  placeholder: {
    height: 190,
    borderRadius: 14,
    backgroundColor: "#EEF5F2",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    gap: 8,
  },
  cameraIcon: { fontSize: 38 },
  placeholderTitle: { color: "#173E35", fontSize: 17, fontWeight: "700" },
  muted: { color: "#667085", fontSize: 13, lineHeight: 19 },
  buttonRow: { flexDirection: "row", gap: 10 },
  primaryButton: {
    minHeight: 46,
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#176B55",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  secondaryButton: {
    minHeight: 46,
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#E8F2EE",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryText: { color: "#176B55", fontWeight: "700", fontSize: 14 },
  label: { color: "#202B38", fontWeight: "700", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#D8E0E8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#202B38",
    backgroundColor: "#FFFFFF",
    fontSize: 15,
  },
  searchButton: { flex: 0, marginTop: 2 },
  notice: {
    backgroundColor: "#FFF8E7",
    color: "#76551A",
    padding: 13,
    borderRadius: 12,
    lineHeight: 20,
    fontSize: 13,
  },
  resultTitle: { fontSize: 20, fontWeight: "800", color: "#172B26" },
  per100: { color: "#176B55", fontWeight: "700", marginTop: 6 },
  nutrients: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  nutrient: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "#F4F7F8",
    padding: 12,
    borderRadius: 12,
    gap: 5,
  },
  nutrientLabel: { color: "#667085", fontSize: 12 },
  nutrientValue: { color: "#172B26", fontSize: 15, fontWeight: "700" },
  disclaimer: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 4 },
  footer: {
    color: "#788393",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
