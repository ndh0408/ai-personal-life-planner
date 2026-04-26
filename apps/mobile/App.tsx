import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <Text style={styles.kicker}>LifeOS AI</Text>
          <Text style={styles.title}>Foundation ready.</Text>
          <Text style={styles.body}>
            Onboarding, Quick Capture, and the Home dashboard arrive in the next round.
          </Text>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0F' },
  center: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 12,
  },
  kicker: {
    color: '#C97B4A',
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { color: '#F4EFE7', fontSize: 32, fontWeight: '600', lineHeight: 38 },
  body: { color: '#9C968B', fontSize: 16, lineHeight: 24 },
});
