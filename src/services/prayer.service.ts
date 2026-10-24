
export interface PrayerTimes {
  date: string;
  city: string;
  country: string;
  timezone: string;
  timings: {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
  };
}

export async function getPrayerTimes(
  city: string,
  country = 'Indonesia',
  date = new Date(),
): Promise<PrayerTimes> {
  if (!city.trim()) {
    throw new Error('Nama kota wajib diisi.');
  }

  const dateString = [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join('-');

  const url =
    'https://api.aladhan.com/v1/timingsByCity/' +
    `${dateString}?city=${encodeURIComponent(city.trim())}` +
    `&country=${encodeURIComponent(country.trim())}` +
    '&method=20';

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Tidak dapat mengambil jadwal salat.');
  }

  const json = await response.json();

  if (json.code !== 200 || !json.data?.timings) {
    throw new Error('Data jadwal salat tidak tersedia untuk lokasi ini.');
  }

  const raw = json.data.timings;

  return {
    date: json.data.date?.readable || dateString,
    city: city.trim(),
    country: country.trim(),
    timezone: json.data.meta?.timezone || 'unknown',
    timings: {
      Fajr: raw.Fajr,
      Sunrise: raw.Sunrise,
      Dhuhr: raw.Dhuhr,
      Asr: raw.Asr,
      Maghrib: raw.Maghrib,
      Isha: raw.Isha,
    },
  };
}

export function getNextPrayer(
  timings: PrayerTimes['timings'],
  now = new Date(),
): { name: string; time: string } | null {
  const prayers = [
    { name: 'Subuh', time: timings.Fajr },
    { name: 'Dzuhur', time: timings.Dhuhr },
    { name: 'Ashar', time: timings.Asr },
    { name: 'Maghrib', time: timings.Maghrib },
    { name: 'Isya', time: timings.Isha },
  ];

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const prayer of prayers) {
    const match = prayer.time.match(/^(\d{1,2}):(\d{2})/);
    if (!match) continue;

    const minutes = Number(match[1]) * 60 + Number(match[2]);

    if (minutes > currentMinutes) {
      return { name: prayer.name, time: prayer.time };
    }
  }

  return prayers.length
    ? { name: 'Subuh (besok)', time: timings.Fajr }
    : null;
}
