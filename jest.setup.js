// Native boundaries only. Business state and authored localization stay real.
jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })) }));
jest.mock('expo-audio',()=>{
  const players=new Map();
  return {setAudioModeAsync:jest.fn().mockResolvedValue(undefined),useAudioPlayer:source=>{
    const key=JSON.stringify(source);if(!players.has(key))players.set(key,{isLoaded:true,pause:jest.fn(),play:jest.fn(),seekTo:jest.fn().mockResolvedValue(undefined),volume:0});return players.get(key);
  }};
});
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined), impactAsync: jest.fn().mockResolvedValue(undefined), notificationAsync: jest.fn().mockResolvedValue(undefined), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' }, NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' } }));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('@expo/ui/datetimepicker', () => ({ DateTimePicker: props => require('react').createElement(require('react-native').View, props) }));
jest.mock('expo-image', () => ({ Image: props => require('react').createElement(require('react-native').View, props) }));
jest.mock('expo', () => ({ reloadAppAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US', languageCode: 'en', textDirection: 'ltr' }] }));
jest.mock('lucide-react-native', () => ({ RefreshCw: () => null, Settings2: () => null, ChevronDown: () => null, ChevronUp: () => null, ChevronRight: () => null, ChevronLeft: () => null, Plus: () => null, Minus: () => null, Check: () => null, X: () => null, Waves: () => null, Activity: () => null, Target: () => null, Brain: () => null, NotebookPen: () => null, Dumbbell: () => null, BookOpen: () => null, Shield: () => null, ShieldCheck: () => null, Globe2: () => null, SunMoon: () => null }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@expo/ui/jetpack-compose', () => ({
  Host: ({ children }) => children,
  RadioButton: jest.fn(() => null),
}));
jest.mock('@expo/ui/jetpack-compose/modifiers', () => ({ testID: value => ({ type: 'testID', value }) }));
jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    Host: ({ children }) => children,
    Text,
    Picker: jest.fn(({ children, ...props }) => React.createElement(View, { ...props, testID: 'mock-native-preference-picker' }, children)),
  };
});
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  pickerStyle: value => ({ type: 'pickerStyle', value }),
  tag: value => ({ type: 'tag', value }),
  tint: value => ({ type: 'tint', value }),
}));
