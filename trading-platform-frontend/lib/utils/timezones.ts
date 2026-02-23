export const TIMEZONES = [
    { value: 'UTC', label: 'UTC', offset: 0 },
    { value: 'EST', label: 'Eastern Standard Time', offset: -5 },
    { value: 'EDT', label: 'Eastern Daylight Time', offset: -4 },
    { value: 'CST', label: 'Central Standard Time', offset: -6 },
    { value: 'CDT', label: 'Central Daylight Time', offset: -5 },
    { value: 'MST', label: 'Mountain Standard Time', offset: -7 },
    { value: 'MDT', label: 'Mountain Daylight Time', offset: -6 },
    { value: 'PST', label: 'Pacific Standard Time', offset: -8 },
    { value: 'PDT', label: 'Pacific Daylight Time', offset: -7 },
    { value: 'AKST', label: 'Alaska Standard Time', offset: -9 },
    { value: 'HST', label: 'Hawaii-Aleutian Standard Time', offset: -10 },
    { value: 'BRT', label: 'Brasilia Time', offset: -3 },
    { value: 'BST', label: 'British Summer Time', offset: 1 },
    { value: 'CET', label: 'Central European Time', offset: 1 },
    { value: 'CEST', label: 'Central European Summer Time', offset: 2 },
    { value: 'EET', label: 'Eastern European Time', offset: 2 },
    { value: 'GST', label: 'Gulf Standard Time', offset: 4 },
    { value: 'IST', label: 'Indian Standard Time', offset: 5.5 },
    { value: 'ICT', label: 'Indochina Time', offset: 7 },
    { value: 'SGT', label: 'Singapore Standard Time', offset: 8 },
    { value: 'CST_CN', label: 'China Standard Time', offset: 8 },
    { value: 'JST', label: 'Japan Standard Time', offset: 9 },
    { value: 'KST', label: 'Korea Standard Time', offset: 9 },
    { value: 'AEST', label: 'Australian Eastern Standard Time', offset: 10 },
    { value: 'AEDT', label: 'Australian Eastern Daylight Time', offset: 11 },
    { value: 'NZST', label: 'New Zealand Standard Time', offset: 12 },
];

export function getOffsetTime(hour: number, offset: number): number {
    let adjusted = hour + offset;
    if (adjusted >= 24) adjusted -= 24;
    if (adjusted < 0) adjusted += 24;

    // Handle fractional offsets (like IST +5.5)
    // For hourly buckets, usually we round/truncate or handle fractional buckets.
    // Given we have integer-based hours 0-23, fractional offsets (like India's 5.5) map to "half-hours".
    // Simplified: Round to nearest hour for bucket display.
    // Or handle as strictly integer offsets for now.

    return Math.floor(adjusted);
}
