import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { File } from 'expo-file-system';
import { Audio } from 'expo-av';

/**
 * Mic recording → base64 audio. Round 21.
 *
 * Press-and-hold pattern: caller invokes `start()` on press-in,
 * `stopAndGetBase64()` on press-out. The hook handles permission
 * prompting, recording state, and producing a base64 payload that
 * the backend `/voice/transcribe` route accepts.
 *
 * Privacy invariants:
 *   - The mic is OFF until `start()` is called.
 *   - We never auto-listen, never use a hotword, never start on
 *     screen mount.
 *   - The local audio file is deleted immediately after we read it
 *     into base64.
 *   - We log nothing about the audio contents.
 */
export interface UseVoiceRecorder {
  recording: boolean;
  durationMs: number;
  /** Returns true on success (mic permission granted + recording started). */
  start: () => Promise<boolean>;
  /** Stops + returns the base64 payload + best-guess mime. Null when nothing recorded. */
  stopAndGetBase64: () => Promise<{ audioBase64: string; mimeType: string } | null>;
  /** Aborts the recording without returning a payload. */
  cancel: () => Promise<void>;
}

export function useVoiceRecorder(): UseVoiceRecorder {
  const [recording, setRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const recRef = useRef<Audio.Recording | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // Defensive cleanup on unmount — never leave the mic running.
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      const r = recRef.current;
      if (r) {
        r.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone permission required.');
        return false;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      // High-quality preset across both platforms; output is m4a/aac on
      // iOS and 3gp/aac on Android — both Whisper-compatible.
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recRef.current = rec;
      startedAtRef.current = Date.now();
      setDurationMs(0);
      setRecording(true);

      // Tick at 250ms for responsive UI without burning the JS thread.
      tickRef.current = setInterval(() => {
        setDurationMs(Date.now() - startedAtRef.current);
      }, 250);
      return true;
    } catch (e) {
      Alert.alert(
        'Could not start recording',
        e instanceof Error ? e.message : String(e),
      );
      return false;
    }
  }, []);

  const finalize = useCallback(async (): Promise<{ uri: string; mimeType: string } | null> => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRecording(false);
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return null;
    try {
      await rec.stopAndUnloadAsync();
    } catch {
      return null;
    }
    const uri = rec.getURI();
    if (!uri) return null;
    const mimeType =
      Platform.OS === 'ios' ? 'audio/m4a' : 'audio/3gpp';
    return { uri, mimeType };
  }, []);

  const stopAndGetBase64 = useCallback(async () => {
    const out = await finalize();
    if (!out) return null;
    try {
      const file = new File(out.uri);
      const audioBase64 = await file.base64();
      // Delete the local file — we never persist audio on-device.
      try {
        file.delete();
      } catch {
        // best-effort
      }
      return { audioBase64, mimeType: out.mimeType };
    } catch {
      return null;
    }
  }, [finalize]);

  const cancel = useCallback(async () => {
    const out = await finalize();
    if (out) {
      try {
        new File(out.uri).delete();
      } catch {
        // best-effort
      }
    }
  }, [finalize]);

  return { recording, durationMs, start, stopAndGetBase64, cancel };
}
