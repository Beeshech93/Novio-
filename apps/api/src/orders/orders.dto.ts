import { Type } from 'class-transformer';
import { Matches, ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @IsUUID() productId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) quantity: number;
}

export class CreateOrderDto {
  @IsOptional() @IsUUID() customerId?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OrderItemDto) items: OrderItemDto[];
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) discount?: number;
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{3,30}$/) couponCode?: string;
}

export class UpdateStatusDto {
  @IsEnum(['NEW', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED']) status: any;
}

export class ListOrdersQuery {
  @IsOptional() @IsEnum(['NEW', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED']) status?: any;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
