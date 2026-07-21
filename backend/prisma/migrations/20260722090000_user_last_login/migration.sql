-- "Last login" for the User Management table. Set on every successful login.
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
