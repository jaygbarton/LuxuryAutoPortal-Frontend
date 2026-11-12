import {expect,it} from 'vitest';
import {formatOnboardingFinancial as format} from '../onboardingFinancialDisplay';
it.each(['70000','70,000','$70,000.00','USD 70,000.00'])('shows the full purchase price %s',value=>expect(format(value)).toBe('$70,000.00'));
it('keeps deferred fields as text and zero as a value',()=>{
  expect(format('To Follow')).toBe('To Follow');
  expect(format('To follow','percent')).toBe('To follow');
  expect(format(0)).toBe('$0.00');
  expect(format(null)).toBe('Not provided');
});
it('adds only one percent sign to numeric rates',()=>{
  expect(format('4.25%','percent')).toBe('4.25%');
  expect(format('4.25','percent')).toBe('4.25%');
});
it.each(['70,00','70,000 plus fees','1e4'])('does not truncate malformed values %s',value=>expect(format(value)).toBe(value));
