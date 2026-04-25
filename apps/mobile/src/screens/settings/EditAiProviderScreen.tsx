import React from 'react';
import { AiProviderForm } from './AiProviderForm';
import type { RootScreenProps } from '../../navigation/types';

export function EditAiProviderScreen({ route }: RootScreenProps<'EditAiProvider'>) {
  return <AiProviderForm providerId={route.params.providerId} />;
}
