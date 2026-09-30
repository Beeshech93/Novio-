import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ServiceDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
  @Type(() => Number) @IsInt() @Min(5) @Max(720) durationMin: number;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
}
export class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(720) durationMin?: number;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
}

export class EmployeeDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEnum(['ACTIVE', 'INACTIVE']) status?: 'ACTIVE' | 'INACTIVE';
}

export class DayHoursDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(6) weekday: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1439) openMin: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1440) closeMin: number;
}
export class SetHoursDto {
  @IsArray() @ArrayMaxSize(7) @ValidateNested({ each: true }) @Type(() => DayHoursDto) days: DayHoursDto[];
}

export class BlockDateDto {
  @Matches(DATE) date: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsString() @MaxLength(120) reason?: string;
}

export class AvailabilityQuery {
  @IsUUID() serviceId: string;
  @Matches(DATE) date: string;
  @IsOptional() @IsUUID() employeeId?: string;
}

export class CreateAppointmentDto {
  @IsUUID() serviceId: string;
  @IsDateString() startAt: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class RescheduleDto {
  @IsDateString() startAt: string;
  @IsOptional() @IsUUID() employeeId?: string;
}

export class AppointmentStatusDto {
  @IsEnum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']) status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
}

export class ListAppointmentsQuery {
  @IsOptional() @Matches(DATE) from?: string;
  @IsOptional() @Matches(DATE) to?: string;
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsEnum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']) status?: any;
}

export class PublicBookingDto {
  @IsUUID() serviceId: string;
  @IsDateString() startAt: string;
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @Matches(/^\+?[0-9 ()-]{7,20}$/) phone: string;
  @IsOptional() @IsEmail() email?: string;
}
