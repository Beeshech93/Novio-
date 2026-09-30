import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CouponDto {
  @Matches(/^[A-Za-z0-9_-]{3,30}$/) code: string;
  @IsEnum(['PERCENT', 'FIXED']) kind: 'PERCENT' | 'FIXED';
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(1_000_000) value: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minSubtotal?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxUses?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}
export class UpdateCouponDto {
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxUses?: number;
  @IsOptional() @IsDateString() endsAt?: string;
}

export class SegmentDto {
  /** Customers with no purchase in the last N days (or never). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) inactiveDays?: number;
  @IsOptional() @IsString() @MaxLength(30) tag?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minSpent?: number;
}

export class CampaignDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsEnum(['whatsapp', 'email']) channel: 'whatsapp' | 'email';
  @IsString() @MinLength(1) @MaxLength(900) message: string;
  @IsOptional() @IsString() @MaxLength(120) subject?: string;
  @IsOptional() @ValidateNested() @Type(() => SegmentDto) segment?: SegmentDto;
}

export class ActionDto {
  @IsEnum(['internal_notification', 'send_whatsapp', 'send_email', 'tag_customer']) type: string;
  @IsOptional() @IsString() @MaxLength(900) message?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(30) tag?: string;
}
export class ConditionDto {
  @Matches(/^[a-zA-Z.]{1,40}$/) field: string;
  @IsEnum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains']) op: string;
  value: string | number | boolean;
}
export class AutomationDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsEnum(['order.created', 'payment.succeeded', 'appointment.created', 'customer.inactive']) trigger: string;
  /** For customer.inactive: days without purchases. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) inactiveDays?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ConditionDto) conditions?: ConditionDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ActionDto) actions: ActionDto[];
}
