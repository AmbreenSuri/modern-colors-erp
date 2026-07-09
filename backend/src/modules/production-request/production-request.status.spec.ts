import { RequestStatus } from '@prisma/client';
import { computeParentStatus } from './production-request.service';

const S = (...statuses: RequestStatus[]) => statuses.map((status) => ({ status }));

describe('computeParentStatus (parent status reflects the line mix)', () => {
  it('all lines pending → PENDING', () => {
    expect(computeParentStatus(S('PENDING', 'PENDING'))).toBe('PENDING');
  });
  it('some reviewed, some pending → IN_PROGRESS', () => {
    expect(computeParentStatus(S('APPROVED', 'PENDING', 'PENDING'))).toBe('IN_PROGRESS');
    expect(computeParentStatus(S('REJECTED', 'PENDING'))).toBe('IN_PROGRESS');
  });
  it('all reviewed & all approved → APPROVED', () => {
    expect(computeParentStatus(S('APPROVED', 'APPROVED'))).toBe('APPROVED');
  });
  it('all reviewed & all rejected → REJECTED', () => {
    expect(computeParentStatus(S('REJECTED', 'REJECTED'))).toBe('REJECTED');
  });
  it('all reviewed, mixed outcome → PARTIAL (the 4-approved / 1-partial / 1-rejected case)', () => {
    expect(
      computeParentStatus(S('APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'PARTIAL', 'REJECTED')),
    ).toBe('PARTIAL');
    expect(computeParentStatus(S('APPROVED', 'REJECTED'))).toBe('PARTIAL');
    expect(computeParentStatus(S('PARTIAL'))).toBe('PARTIAL');
  });
  it('no lines → PENDING', () => {
    expect(computeParentStatus([])).toBe('PENDING');
  });
});
