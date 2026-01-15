export function processLocationData(locationData: any) {
  if (!locationData) return undefined;

  const processSingleLocation = (loc: any) => {
    if (!loc) return undefined;

    let result: any = {};

    if (loc.address) {
      result.address = loc.address;
    }

    if (loc.coordinates && (loc.coordinates[0] || loc.coordinates[1])) {
      result.coordinates = [
        parseFloat(loc.coordinates[0]) || 0,
        parseFloat(loc.coordinates[1]) || 0,
      ];
      result.type = 'Point';
    }

    return Object.keys(result).length > 0 ? result : undefined;
  };

  const result: any = {};
  if (locationData.primary)
    result.primary = processSingleLocation(locationData.primary);
  if (locationData.secondary)
    result.secondary = processSingleLocation(locationData.secondary);
  if (locationData.tertiary)
    result.tertiary = processSingleLocation(locationData.tertiary);

  return Object.keys(result).length > 0 ? result : undefined;
}
