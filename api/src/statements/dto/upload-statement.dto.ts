import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * CSV upload is sent as JSON text (the browser reads the file client-side and
 * posts its contents), so there's no multipart dependency. The CSV body is
 * bounded here; row-count limits are enforced by the ingest layer.
 */
export class UploadStatementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5_000_000)
  csv!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  bankHint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  accountName?: string;
}
