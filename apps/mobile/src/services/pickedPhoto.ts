// Validates what the system picker returned before the app trusts it.

export type PickedPhoto = { readonly uri: string; readonly width: number; readonly height: number };

export type PickOutcome =
  | { readonly kind: 'picked'; readonly photo: PickedPhoto }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'permissionDenied'; readonly canAskAgain: boolean }
  | { readonly kind: 'failed' };

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

export function toPickOutcome(result: unknown): PickOutcome {
  if (typeof result !== 'object' || result === null) {
    return { kind: 'failed' };
  }
  if (Reflect.get(result, 'canceled') === true) {
    return { kind: 'cancelled' };
  }
  const assets: unknown = Reflect.get(result, 'assets');
  const asset: unknown = Array.isArray(assets) ? assets[0] : undefined;
  if (typeof asset !== 'object' || asset === null) {
    return { kind: 'failed' };
  }
  const uri: unknown = Reflect.get(asset, 'uri');
  const width: unknown = Reflect.get(asset, 'width');
  const height: unknown = Reflect.get(asset, 'height');
  if (
    typeof uri !== 'string' ||
    uri.length === 0 ||
    !isPositiveInteger(width) ||
    !isPositiveInteger(height)
  ) {
    return { kind: 'failed' };
  }
  return { kind: 'picked', photo: { uri, width, height } };
}
