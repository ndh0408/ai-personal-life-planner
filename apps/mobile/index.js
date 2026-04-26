/**
 * Entry point. The two side-effect imports MUST be first:
 *   • react-native-gesture-handler — initialises the gesture system before
 *     anything tries to render a navigator.
 *   • react-native-reanimated      — needed at the very top of the bundle so
 *     the worklet runtime is wired before any animation code runs.
 *
 * @format
 */
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
