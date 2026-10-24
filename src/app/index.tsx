import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

export default function Index() {
  const db = useSQLiteContext();

  const [isLoading, setIsLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    async function checkUserProfile() {
      try {
        const result = await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM user_preferences'
        );

        setHasProfile((result?.count ?? 0) > 0);
      } catch (error) {
        console.error('Gagal mengecek profile:', error);
      } finally {
        setIsLoading(false);
      }
    }

    checkUserProfile();
  }, [db]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!hasProfile) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/tabs" />;
}