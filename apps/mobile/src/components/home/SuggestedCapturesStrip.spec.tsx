import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SuggestedCapturesStrip } from './SuggestedCapturesStrip';
import type { SuggestedCapture } from '../../services/api/dashboard.service';

const SUGGESTIONS: SuggestedCapture[] = [
  { text: 'Bữa trưa…', mode: 'MEAL', reason: 'Giờ trưa' },
  { text: 'Cà phê 35k', mode: 'EXPENSE', reason: 'Mẫu thường gặp' },
];

describe('SuggestedCapturesStrip', () => {
  it('renders nothing when the list is empty', () => {
    const { queryByText } = render(<SuggestedCapturesStrip suggestions={[]} onPress={() => undefined} />);
    expect(queryByText(/Gợi ý|suggestions/i)).toBeNull();
  });

  it('renders one chip per suggestion with text + reason', () => {
    const { getByText } = render(<SuggestedCapturesStrip suggestions={SUGGESTIONS} onPress={() => undefined} />);
    expect(getByText('Bữa trưa…')).toBeTruthy();
    expect(getByText('Giờ trưa')).toBeTruthy();
    expect(getByText('Cà phê 35k')).toBeTruthy();
  });

  it('passes the tapped suggestion back to onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(<SuggestedCapturesStrip suggestions={SUGGESTIONS} onPress={onPress} />);
    fireEvent.press(getByText('Cà phê 35k'));
    expect(onPress).toHaveBeenCalledWith(SUGGESTIONS[1]);
  });
});
