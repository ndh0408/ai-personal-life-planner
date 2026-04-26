import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  profileService,
  type UpdateProfileInput,
  type UserProfile,
} from '../services/api/profile.service';

const KEY = ['profile'] as const;

export function useProfile() {
  return useQuery({ queryKey: KEY, queryFn: () => profileService.get() });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation<UserProfile, unknown, UpdateProfileInput>({
    mutationFn: (input) => profileService.update(input),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
