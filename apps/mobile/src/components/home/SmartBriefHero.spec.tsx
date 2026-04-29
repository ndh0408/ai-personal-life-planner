import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SmartBriefHero } from './SmartBriefHero';
import type { SmartBrief } from '../../services/api/dashboard.service';

const URGENT_BRIEF: SmartBrief = {
  headline: 'Đã vượt ngân sách',
  body: 'Đã chi 11M / 10M tháng này.',
  tone: 'urgent',
  source: 'RULE',
  reasonLabels: ['vượt mức', 'ngân sách'],
  primaryAction: { label: 'Xem chi tiêu', screen: 'Money' },
};

describe('SmartBriefHero', () => {
  it('renders the headline + reason chips when a brief is present', () => {
    const { getByText } = render(<SmartBriefHero brief={URGENT_BRIEF} greetingName="Nam" />);
    expect(getByText('Đã vượt ngân sách')).toBeTruthy();
    expect(getByText('vượt mức')).toBeTruthy();
    expect(getByText('ngân sách')).toBeTruthy();
  });

  it('falls back to a calm greeting when brief is null', () => {
    const { getByText } = render(<SmartBriefHero brief={null} greetingName="Nam" />);
    // The mock i18n returns the key when no defaultValue is supplied;
    // SmartBriefHero supplies a Vietnamese defaultValue, so we expect that.
    expect(getByText(/Hôm nay yên|Quiet today/)).toBeTruthy();
  });

  it('fires onAction when the primaryAction CTA is tapped', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <SmartBriefHero brief={URGENT_BRIEF} greetingName="Nam" onAction={onAction} />,
    );
    fireEvent.press(getByText('Xem chi tiêu'));
    expect(onAction).toHaveBeenCalledWith(URGENT_BRIEF.primaryAction);
  });
});
