// Stub for build-only packages that @astrojs/vercel 11.0.13 leaks into the server entry as bare
// side-effect imports (`import "rolldown"`). Rolldown's native binding isn't shipped to the function,
// so loading it crashes every on-demand route. The adapter itself uses rolldown from Node, not via Vite.
export {};
export function rolldown() {
  throw new Error('rolldown is build-only and is not available in the serverless function');
}
export default {};
