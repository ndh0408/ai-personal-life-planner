import React from 'react';
import { render } from '@testing-library/react-native';
import { KindBadge } from './KindBadge';

describe('KindBadge', () => {
  it('renders the i18n key for the given kind', () => {
    const { getByText } = render(<KindBadge kind="EXPENSE" />);
    // The jest setup mocks useTranslation to return the key when no
    // defaultValue is provided, so the rendered label is the i18n path.
    expect(getByText('capture.kinds.EXPENSE')).toBeTruthy();
  });

  it.each(['INCOME', 'MEAL', 'TASK', 'SLEEP', 'MOOD', 'UNKNOWN'] as const)(
    'renders for %s',
    (kind) => {
      const { getByText } = render(<KindBadge kind={kind} />);
      expect(getByText(`capture.kinds.${kind}`)).toBeTruthy();
    },
  );
});
