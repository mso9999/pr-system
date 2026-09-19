import exceptions from './masReconciliationExceptions.json';
/** Exact known conflicts cannot be approved by renaming the record or ticking a box. */
export function reconciliationBlock(partId: string, assetId: string, asset: any, part: any): string | null {
  const conflict = exceptions.blockedPairs.find(p => p.partId === partId && p.assetId === assetId);
  if (conflict) return conflict.reason + ' Record an alternative/component decision or ask the catalogue steward to resolve the source conflict.';
  if (partId === 'stay-wire-3x3.35' && /7[\/x×]3\.35/i.test(part.name || '')) return 'UGP part number says 3x3.35 but its name says 7/3.35. RET must correct the engineering source before publication.';
  const original = asset.original_catalogue_identity || asset;
  const text = ((original.name || '') + ' ' + (original.description || '')).toLowerCase();
  if (partId === 'hook-bolt-m16' && /(?:m16\s*[x×]\s*380|380\s*mm)/i.test(text)) return '380mm bolt cannot be published as the required 200mm bolt. Record an engineering alternative.';
  if (partId === 'cable-tie-200mm' && /390\s*(?:mm|[x×])/i.test(text)) return '390mm tie cannot be published as a 200mm tie.';
  if (partId === 'fuse-mv-dropout' && /fuse\s*link/i.test(text) && !/cutout|cut out|with fuse tube/i.test(text)) return 'A fuse link is a component, not a complete dropout cutout.';
  if (/insulator-assembly|mv-stay-kit|crows-foot-earthing-system|earthing-kit-mv-sparkgap/.test(partId) && !/complete|assembly|\bkit\b|system/.test(text)) return 'This requirement is a complete assembly. The AM description identifies a component: record a component decision and its quantities, or identify a complete kit.';
  // Distinct product families: do not turn equipment into hardware through canonical naming.
  const families: Record<string, RegExp> = {
    'cross-arm-mv-2.5m': /cross[ -]?arm/,
    'pole-wooden-10m': /(?:wood|cca|treated).*pole|pole.*(?:wood|cca|treated|10\s*m)/,
    'pole-wooden-9m': /(?:wood|cca|treated).*pole|pole.*(?:wood|cca|treated|9\s*m)/,
    'earthing-rod': /earth.*(?:rod|spike)|(?:rod|spike).*earth/,
    'abc-dead-end-clamp': /abc|bundled conductor/,
    'meter-inhouse-1mtr': /meter|1mtr/,
  };
  if (families[partId] && !families[partId].test(text)) return 'The original AM description does not identify this type of part. Inspect the item and correct its source identity, or record Not a match.';
  return null;
}
