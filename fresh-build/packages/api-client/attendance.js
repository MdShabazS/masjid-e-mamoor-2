/** Map a device position to the arguments the server validates. The fix's own
 * capture time is sent so a cached reading is rejected as stale, not refreshed. */
export function locationArgs(position) {
  const { latitude, longitude, accuracy } = position?.coords ?? {};
  if (![latitude, longitude, accuracy, position?.timestamp].every(Number.isFinite))
    throw new Error('Could not read this phone’s location. Try again.');
  return {
    p_latitude: latitude,
    p_longitude: longitude,
    p_accuracy_m: accuracy,
    p_captured_at: new Date(position.timestamp).toISOString(),
    p_mocked: position.mocked === true,
  };
}

export function parseSiteCoordinates(latitudeText, longitudeText) {
  const decimal = /^-?\d{1,3}\.\d{4,}$/;
  const latitude = latitudeText?.trim() ?? '';
  const longitude = longitudeText?.trim() ?? '';
  if (!decimal.test(latitude) || !decimal.test(longitude))
    throw new Error('Enter both coordinates as decimals with at least 4 decimal places.');
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw new Error('Those coordinates are out of range.');
  return { p_latitude: lat, p_longitude: lng };
}
