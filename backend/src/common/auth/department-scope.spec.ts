import { ForbiddenException } from '@nestjs/common';
import { Department, Role } from '@prisma/client';
import { AuthUser } from '../decorators/current-user.decorator';
import {
  assertDepartmentAccess,
  departmentFilter,
  isCrossDepartment,
  ownDepartment,
} from './department-scope';

const user = (role: Role, department: Department | null = null): AuthUser => ({
  id: 'u',
  email: 'u@x',
  name: 'u',
  role,
  department,
});

const STORE = user(Role.ADMIN);
const ADMIN = user(Role.OVERSIGHT);
const PU = user(Role.PRODUCTION_HEAD, Department.PU);
const ENAMEL = user(Role.PRODUCTION_HEAD, Department.ENAMEL);
const HEAD_NO_DEPT = user(Role.PRODUCTION_HEAD, null);
const OPERATOR = user(Role.OPERATOR);

describe('department-scope (Phase 2 server-side isolation)', () => {
  describe('isCrossDepartment', () => {
    it('Store and Admin see all departments', () => {
      expect(isCrossDepartment(STORE)).toBe(true);
      expect(isCrossDepartment(ADMIN)).toBe(true);
    });
    it('production heads and operators do NOT', () => {
      expect(isCrossDepartment(PU)).toBe(false);
      expect(isCrossDepartment(OPERATOR)).toBe(false);
    });
  });

  describe('departmentFilter (list scoping)', () => {
    it('Store / Admin get an unscoped filter (all departments)', () => {
      expect(departmentFilter(STORE)).toEqual({});
      expect(departmentFilter(ADMIN)).toEqual({});
    });
    it('a head is scoped to their own department only', () => {
      expect(departmentFilter(PU)).toEqual({ department: Department.PU });
      expect(departmentFilter(ENAMEL)).toEqual({ department: Department.ENAMEL });
    });
    it('a head with no department is denied', () => {
      expect(() => departmentFilter(HEAD_NO_DEPT)).toThrow(ForbiddenException);
    });
    it('any other role is denied (defense in depth)', () => {
      expect(() => departmentFilter(OPERATOR)).toThrow(ForbiddenException);
    });
  });

  describe('assertDepartmentAccess (single-resource guard)', () => {
    it('Store / Admin may access any department', () => {
      expect(() => assertDepartmentAccess(STORE, Department.POWDER)).not.toThrow();
      expect(() => assertDepartmentAccess(ADMIN, Department.ENAMEL)).not.toThrow();
    });
    it('a head may access ONLY their own department', () => {
      expect(() => assertDepartmentAccess(PU, Department.PU)).not.toThrow();
    });
    it("a head is BLOCKED from another department's resource (the key isolation case)", () => {
      expect(() => assertDepartmentAccess(PU, Department.ENAMEL)).toThrow(ForbiddenException);
      expect(() => assertDepartmentAccess(ENAMEL, Department.PU)).toThrow(ForbiddenException);
    });
    it('operators are blocked entirely', () => {
      expect(() => assertDepartmentAccess(OPERATOR, Department.PU)).toThrow(ForbiddenException);
    });
  });

  describe('ownDepartment (forced department on create)', () => {
    it("returns the head's own department", () => {
      expect(ownDepartment(PU)).toBe(Department.PU);
      expect(ownDepartment(ENAMEL)).toBe(Department.ENAMEL);
    });
    it('rejects non-heads and heads without a department', () => {
      expect(() => ownDepartment(STORE)).toThrow(ForbiddenException);
      expect(() => ownDepartment(ADMIN)).toThrow(ForbiddenException);
      expect(() => ownDepartment(HEAD_NO_DEPT)).toThrow(ForbiddenException);
    });
  });
});
