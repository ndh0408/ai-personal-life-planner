/**
 * Thin re-export so the rest of the codebase lives under src/.
 * Native init (gesture-handler, reanimated) happens in index.js before us.
 */
export { App as default } from './src/app/App';
