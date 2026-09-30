import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CustomerDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
}

export class ListCustomersQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(30) tag?: string;
  /** Segmentation: customers with no purchase in the last N days (or never). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) inactiveDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
