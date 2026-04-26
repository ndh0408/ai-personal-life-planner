import { useMutation } from '@tanstack/react-query';
import {
  captureService,
  type CaptureConfirmRequest,
  type CaptureConfirmResponse,
  type CaptureParseResponse,
} from '../services/api/capture.service';

export function useCaptureParse() {
  return useMutation<CaptureParseResponse, unknown, string>({
    mutationFn: (text: string) => captureService.parse(text),
  });
}

export function useCaptureConfirm() {
  return useMutation<CaptureConfirmResponse, unknown, CaptureConfirmRequest>({
    mutationFn: (input) => captureService.confirm(input),
  });
}
