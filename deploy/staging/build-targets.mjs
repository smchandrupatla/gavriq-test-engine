/** Build shared API/worker images once, after Compose has resolved all overlays. */
export function uniqueBuildServices(services, config) {
  const images = new Map();
  return services.filter(name => {
    const service = config.services?.[name];
    if (!service) throw new Error(`Staging service is missing from Compose: ${name}`);
    if (!service.build) return false;
    const image = service.image || name;
    const definition = JSON.stringify(service.build);
    if (!images.has(image)) { images.set(image, definition); return true; }
    if (images.get(image) !== definition) throw new Error(`Staging image has conflicting build definitions: ${image}`);
    return false;
  });
}
