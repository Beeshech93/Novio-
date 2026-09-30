import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export class BusinessInfoDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsString() @MaxLength(40) category: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsEmail() email?: string;
}

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
  @ValidateNested() @Type(() => BusinessInfoDto) business: BusinessInfoDto;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) goals?: string[];
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(72) password: string;
}

export class TokenDto {
  @IsString() @MinLength(20) @MaxLength(100) token: string;
}
export class ForgotDto {
  @IsEmail() email: string;
}
export class ResetDto {
  @IsString() @MinLength(20) @MaxLength(100) token: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
}
