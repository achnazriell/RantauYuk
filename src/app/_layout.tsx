import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';

import { initializeDatabase } from '@/database/schema';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName="rantau_yuk.db"
      onInit={initializeDatabase}
    >
      <StatusBar style="dark" />

      <Stack
        screenOptions={{
          // Header dibuat sendiri lewat <ScreenHeader /> agar konsisten.
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </SQLiteProvider>
  );
}
