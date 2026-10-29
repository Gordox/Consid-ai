// A small starting list of cartridge names for the calibre picker. Every name and alias below
// appears in SAAMI's "Generally Accepted Cartridge and Chamber Names" (10/8/2021,
// https://saami.org/wp-content/uploads/2024/11/SAAMI-Generally-Accepted-Cartridge-and-Chambers-10-8-2021.pdf),
// which states that its list is not exhaustive; neither is this one. The SAAMI full name is the
// stored value. Aliases only help searching: picking an alias never rewrites a saved value, and
// similar names are never merged. A calibre is a label only; it never sets a hole diameter or
// affects scoring.

export type NamedCalibre = {
  readonly name: string;
  readonly aliases: readonly string[];
};

export const NAMED_CALIBRES: readonly NamedCalibre[] = [
  { name: '22 Long Rifle', aliases: ['22 LR'] },
  { name: '22 Winchester Magnum Rimfire', aliases: ['22 WMR', '22 Win Mag', '22 Magnum'] },
  { name: '25 Automatic', aliases: ['25 AUTO', '25 ACP', '6.35mm Browning'] },
  { name: '30 Luger', aliases: ['7.65 Parabellum', '7.65 Luger'] },
  { name: '32 Automatic', aliases: ['32 AUTO', '32 ACP', '7.65 Browning', '7.65mm Browning'] },
  { name: '32 Smith & Wesson Long', aliases: ['32 S&WL', '32 Colt New Police'] },
  { name: '38 Special', aliases: ['38 SPL', '38 S&W Special', '38 Special Wadcutter'] },
  { name: '380 Automatic', aliases: ['380 AUTO', '380 ACP', '9mm Kurz', '9mm Browning Short'] },
  { name: '9mm Luger', aliases: ['9MM LUGER', '9mm Parabellum', '9x19mm'] },
  { name: '9x18 Makarov', aliases: ['9x18 MAK', '9mm Makarov'] },
  { name: '44 Remington Magnum', aliases: ['44 REM MAG', '44 Magnum'] },
  { name: '45 Automatic', aliases: ['45 AUTO', '45 ACP'] },
  { name: '45 Colt', aliases: ['45 COLT', '45 Long Colt'] },
  { name: '223 Remington', aliases: [] },
  { name: '300 AAC Blackout', aliases: ['300 BLK', '7.62x35mm'] },
  { name: '30-30 Winchester', aliases: ['30-30 WIN', '30 WCF'] },
  { name: '30-06 Springfield', aliases: ['30-06 SPRG', '30-06', '7.62x63mm'] },
  { name: '338 Lapua Magnum', aliases: ['338 LAPUA MAG', '8.6x70mm'] },
  { name: '7mm Mauser', aliases: ['7x57', '7x57mm'] },
  { name: '8mm Mauser', aliases: ['7.92x57mm', '8x57', '8x57mm JS'] },
];

// Case, spacing, dashes and the × sign are ignored when searching, so "9X19" finds 9mm Luger.
function searchKey(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[×]/g, 'x')
    .replace(/[\s\-–.]/g, '');
}

export function searchCalibres(query: string): NamedCalibre[] {
  const key = searchKey(query);
  if (key === '') return [...NAMED_CALIBRES];
  return NAMED_CALIBRES.filter((calibre) =>
    [calibre.name, ...calibre.aliases].some((text) => searchKey(text).includes(key)),
  );
}

// Whether a stored value is exactly one of the listed names. Anything else (older free text,
// an alias or a custom entry) is kept and shown as it is, as a custom calibre.
export function isNamedCalibre(value: string): boolean {
  return NAMED_CALIBRES.some((calibre) => calibre.name === value);
}
