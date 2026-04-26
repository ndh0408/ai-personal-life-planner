import { registerRootComponent } from 'expo';
import App from './App';

// expo-router will be wired in a later round; foundation registers App directly.
registerRootComponent(App);
