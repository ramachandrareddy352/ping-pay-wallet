import 'react-native-get-random-values';
import 'fast-text-encoding';
import { AppRegistry } from 'react-native';
import { Buffer } from 'buffer';
import process from 'process';
import App from './App';
import { packageName } from './app.json';

global.Buffer = Buffer;
global.process = process;

if (typeof global.window === 'undefined') {
  global.window = {};
}

if (!global.window.addEventListener) {
  global.window.addEventListener = () => {};
}

if (!global.window.removeEventListener) {
  global.window.removeEventListener = () => {};
}

AppRegistry.registerComponent(packageName, () => App);
