import { Linking } from 'react-native';
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

/**
 * Maps `lifeos://` URLs (originated from a widget tap, an OS shortcut, or
 * a notification deep-link) onto the React Navigation route graph. We
 * deliberately keep this list short and well-typed — every entry is a
 * widget Quick Action surfaced in `WidgetSettingsScreen` and documented
 * in `docs/DEEP_LINKS.md`.
 */
type RouteResolver = (
  nav: NativeStackNavigationProp<RootStackParamList>,
  url: URL,
) => void;

const ROUTES: Record<string, RouteResolver> = {
  // lifeos://today
  today: (nav) => nav.navigate('Main'),
  // lifeos://assistant
  assistant: (nav) => nav.navigate('Main'),
  // lifeos://ai-chat
  'ai-chat': (nav) => nav.navigate('AIChat'),
  // lifeos://tasks/add
  tasks: (nav, url) => {
    if (url.pathname.endsWith('/add') || url.host === 'tasks') {
      nav.navigate('CreateTask');
    } else {
      nav.navigate('Tasks');
    }
  },
  // lifeos://finance/add-expense | /add-income
  finance: (nav, url) => {
    if (url.pathname.includes('add-expense')) nav.navigate('AddExpense');
    else if (url.pathname.includes('add-income')) nav.navigate('AddIncome');
    else nav.navigate('Main');
  },
  // lifeos://meals/quick-log
  meals: (nav) => nav.navigate('MealQuickLog'),
  // lifeos://health/check-in
  health: (nav, url) => {
    if (url.pathname.includes('mood')) nav.navigate('MoodQuickLog');
    else if (url.pathname.includes('sleep')) nav.navigate('SleepQuickLog');
    else nav.navigate('SleepMoodCheckin');
  },
  // lifeos://recommendation/:id  → opens the Smart Context list
  recommendation: (nav) => nav.navigate('ContextInferences'),
  // lifeos://widget-settings — convenience for the in-app settings screen
  'widget-settings': (nav) => nav.navigate('WidgetSettings'),
};

function dispatch(
  url: string,
  nav: NativeStackNavigationProp<RootStackParamList>,
): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'lifeos:') return false;
    // Expo Linking gives us host=path[0]/...; URL parses the host into
    // u.host and the rest into u.pathname.
    const head = u.host || u.pathname.replace(/^\//, '').split('/')[0];
    const handler = ROUTES[head];
    if (!handler) return false;
    handler(nav, u);
    return true;
  } catch {
    return false;
  }
}

/** Hook into the root navigator so initial + runtime deep links route. */
export function useDeepLinkRouter() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useEffect(() => {
    Linking.getInitialURL().then((url: string | null) => {
      if (url) dispatch(url, nav);
    });
    const sub = Linking.addEventListener('url', ({ url }: { url: string }) =>
      dispatch(url, nav),
    );
    return () => sub.remove();
  }, [nav]);
}

/** Programmatic helper used by the in-app preview. */
export function fireDeepLink(url: string): void {
  Linking.openURL(url).catch(() => undefined);
}

/** Stable list of every `lifeos://` URL the widget may emit. */
export const KNOWN_DEEP_LINKS = [
  'lifeos://today',
  'lifeos://assistant',
  'lifeos://ai-chat',
  'lifeos://tasks/add',
  'lifeos://finance/add-expense',
  'lifeos://finance/add-income',
  'lifeos://meals/quick-log',
  'lifeos://health/check-in',
  'lifeos://health/mood',
  'lifeos://health/sleep',
  'lifeos://recommendation',
  'lifeos://widget-settings',
] as const;
export type KnownDeepLink = (typeof KNOWN_DEEP_LINKS)[number];
