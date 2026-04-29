import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AssistantActionChips } from './AssistantActionChips';
import type { MobileAssistantAction } from '../../services/api/assistantStream.client';

const ACTIONS: MobileAssistantAction[] = [
  { type: 'GENERATE_TODAY_PLAN', label: 'Lập kế hoạch hôm nay' },
  { type: 'OPEN_SMART_ENTRY', label: 'Lưu vào sổ', prefillText: 'phở 60k', mode: 'EXPENSE' },
  { type: 'OPEN_SCREEN', label: 'Xem hôm nay', screen: 'Today' },
];

describe('AssistantActionChips', () => {
  it('renders nothing when the list is empty', () => {
    const { queryByText } = render(<AssistantActionChips actions={[]} onPress={() => undefined} />);
    expect(queryByText(/.*/)).toBeNull();
  });

  it('renders one chip per action', () => {
    const { getByText } = render(<AssistantActionChips actions={ACTIONS} onPress={() => undefined} />);
    expect(getByText('Lập kế hoạch hôm nay')).toBeTruthy();
    expect(getByText('Lưu vào sổ')).toBeTruthy();
    expect(getByText('Xem hôm nay')).toBeTruthy();
  });

  it('passes the tapped action verbatim to onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(<AssistantActionChips actions={ACTIONS} onPress={onPress} />);
    fireEvent.press(getByText('Lưu vào sổ'));
    expect(onPress).toHaveBeenCalledWith(ACTIONS[1]);
  });
});
