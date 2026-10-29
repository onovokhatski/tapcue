/** Project assets are served by the server as they are named in project.json: "assets/x.jpg" → "/assets/x.jpg". */
export function assetUrl(asset: string) {
  return `/${asset}`;
}
