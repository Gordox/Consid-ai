import type { FirearmType } from '../../domain/session/firearmType';

// Display labels for the stable internal values (decision B2).
export const FIREARM_TYPE_LABELS: Record<FirearmType, string> = {
  pistol: 'Pistol',
  revolver: 'Revolver',
  rifle: 'Rifle',
  other: 'Other',
};
