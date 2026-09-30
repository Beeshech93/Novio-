import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested, IsUrl } from 'class-validator';
import { TEMPLATES } from './templates';

const URL_OPTS = { protocols: ['https', 'http'], require_protocol: true };

export class HourDto {
  @IsString() @MaxLength(20) day: string;
  @IsString() @MaxLength(30) hours: string;
}

export class SiteContentDto {
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsString() @MaxLength(160) tagline?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUrl(URL_OPTS) @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsUrl(URL_OPTS, { each: true }) photos?: string[];
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) primaryColor?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) accentColor?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @ValidateNested({ each: true }) @Type(() => HourDto) hours?: HourDto[];
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsUrl({ ...URL_OPTS, host_whitelist: ['maps.google.com', 'www.google.com', 'google.com', 'maps.app.goo.gl', 'goo.gl'] }) mapsUrl?: string;
  @IsOptional() @Matches(/^\+?[0-9]{8,15}$/) whatsapp?: string;
  @IsOptional() @Matches(/^\+?[0-9 ()-]{6,20}$/) phone?: string;
  @IsOptional() @IsUrl(URL_OPTS) instagram?: string;
  @IsOptional() @IsUrl(URL_OPTS) facebook?: string;
  @IsOptional() @IsUrl(URL_OPTS) tiktok?: string;
}

export class UpdateWebsiteDto {
  @IsOptional() @IsIn(TEMPLATES.map((t) => t.slug)) templateSlug?: string;
  /** Lowercase letters, digits and hyphens: becomes <subdomain>.nuvio.app */
  @IsOptional() @Matches(/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/) subdomain?: string;
  @IsOptional() @ValidateNested() @Type(() => SiteContentDto) content?: SiteContentDto;
  @IsOptional() @IsBoolean() published?: boolean;
}
