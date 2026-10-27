// Stable internal values. Display labels belong to the UI layer.
export const FIREARM_TYPES = ['pistol', 'revolver', 'rifle', 'other'] as const;

export type FirearmType = (typeof FIREARM_TYPES)[number];

export function isFirearmType(value: unknown): value is FirearmType {
  return FIREARM_TYPES.some((firearmType) => firearmType === value);
}
