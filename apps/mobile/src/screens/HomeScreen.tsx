import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { env } from '../config/env';

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.title}>AI Personal Life Planner</Text>
        <Text style={styles.subtitle}>Foundation ready. Business features come next.</Text>
        <Text style={styles.meta}>API: {env.apiBaseUrl}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0F' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#B5B5C3', fontSize: 14, marginBottom: 24, textAlign: 'center' },
  meta: { color: '#6B7280', fontSize: 12 },
});
