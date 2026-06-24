import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// All fields optional; password (if provided) is re-hashed.
export class UpdateUserDto extends PartialType(CreateUserDto) {}
