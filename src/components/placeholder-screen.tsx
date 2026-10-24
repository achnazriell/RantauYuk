import { View } from 'react-native';

import { Badge, EmptyState, Screen, ScreenHeader } from '@/components/ui';
import type { IconName } from '@/components/ui';

type PlaceholderScreenProps = {
  icon: IconName;
  title: string;
  description: string;
};

/** Dipakai oleh layar yang masih kerangka (sholat, habit, tempat, dll.). */
export function PlaceholderScreen({
  icon,
  title,
  description,
}: PlaceholderScreenProps) {
  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        back
        title={title}
        subtitle={description}
        right={<Badge label="Segera hadir" tone="accent" icon="time-outline" />}
      />

      <View>
        <EmptyState
          icon={icon}
          title="Fitur ini sedang disiapkan"
          description="Halaman ini akan aktif di pembaruan berikutnya."
        />
      </View>
    </Screen>
  );
}
