import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ProductDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) compareAtPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) cost?: number;
  @IsOptional() @IsString() @MaxLength(60) sku?: string;
  @IsOptional() @IsString() @MaxLength(60) barcode?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) taxRate?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stock?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minStock?: number;
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) compareAtPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) cost?: number;
  @IsOptional() @IsString() @MaxLength(60) sku?: string;
  @IsOptional() @IsString() @MaxLength(60) barcode?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) taxRate?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) stock?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minStock?: number;
}

export class ListProductsQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class ImportCsvDto {
  @IsString() @MaxLength(2_000_000) csv: string;
}

export class CategoryDto {
  @IsString() @MinLength(1) @MaxLength(60) name: string;
}
