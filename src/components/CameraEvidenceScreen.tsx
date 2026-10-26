import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { SQLiteDatabase } from 'expo-sqlite';
import { submitCameraEvidence } from '@/services/schedule-verification.service';

type Props = {
  db: SQLiteDatabase;
  scheduleId: number;
  scheduleTitle: string;
  onVerified?: (evidenceUri: string) => void;
  onCancel?: () => void;
};

export default function CameraEvidenceScreen({
  db, scheduleId, scheduleTitle, onVerified, onCancel,
}: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [takingPhoto, setTakingPhoto] = useState(false);

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Memeriksa izin kamera…</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Izin kamera diperlukan</Text>
        <Text style={styles.muted}>Foto bukti diambil langsung dari kamera. Galeri tidak digunakan.</Text>
        <TouchableOpacity style={styles.button} onPress={() => void requestPermission()}>
          <Text style={styles.buttonText}>Izinkan kamera</Text>
        </TouchableOpacity>
        {onCancel ? <TouchableOpacity onPress={onCancel}><Text style={styles.cancel}>Batal</Text></TouchableOpacity> : null}
      </View>
    );
  }

  async function capture() {
    if (!cameraRef.current || takingPhoto) return;
    setTakingPhoto(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.75, skipProcessing: false });
      if (!photo?.uri) throw new Error('Kamera tidak menghasilkan foto.');
      await submitCameraEvidence(db, scheduleId, photo.uri, `Bukti foto untuk: ${scheduleTitle}`);
      Alert.alert('Bukti tersimpan', 'Foto kamera telah dicatat dan jadwal ditandai selesai. Ini memverifikasi pengiriman foto, bukan isi foto secara otomatis.');
      onVerified?.(photo.uri);
    } catch (error) {
      Alert.alert('Gagal menyimpan bukti', error instanceof Error ? error.message : 'Terjadi kesalahan saat mengambil foto.');
    } finally {
      setTakingPhoto(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.footer}>
        <Text style={styles.title}>Bukti tugas</Text>
        <Text style={styles.muted}>{scheduleTitle}</Text>
        <Text style={styles.hint}>Ambil foto langsung. Pemilihan gambar dari galeri tidak tersedia di layar ini.</Text>
        <TouchableOpacity style={[styles.button, takingPhoto && styles.disabled]} disabled={takingPhoto} onPress={() => void capture()}>
          <Text style={styles.buttonText}>{takingPhoto ? 'Menyimpan…' : 'Ambil foto & kirim bukti'}</Text>
        </TouchableOpacity>
        {onCancel ? <TouchableOpacity onPress={onCancel}><Text style={styles.cancel}>Batal</Text></TouchableOpacity> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D192B' },
  camera: { flex: 1, minHeight: 300 },
  footer: { padding: 20, gap: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 14, backgroundColor: '#0D192B' },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  muted: { color: '#C5D0DF', textAlign: 'center' },
  hint: { color: '#F4C76B', fontSize: 13 },
  button: { backgroundColor: '#208AEF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  cancel: { color: '#FFFFFF', textAlign: 'center', padding: 10 },
});
