/**
 * Check if a user proximity is on on with a point range
 * @param userLat The latitude of the user
 * @param userLong The longitude of the user
 * @param pointtLat The latitude of the point
 * @param pointLong The longitude of the point
 * @param proximity The proximity of the user
 * @param range The range of the user
 */
export function isWithProximity(
  userLat: number,
  userLong: number,
  pointtLat: number,
  pointLong: number,
  proximity: number = 100,
  range: number = 10,
): boolean {
  const R = 6371e3; // metres
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRadians(pointtLat - userLat);
  const dLong = toRadians(pointLong - userLong);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(userLat)) *
      Math.cos(toRadians(pointtLat)) *
      Math.sin(dLong / 2) *
      Math.sin(dLong / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= proximity + range;
}
