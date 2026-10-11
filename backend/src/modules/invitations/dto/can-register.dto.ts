import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CanRegisterResponseDto {
  @ApiProperty({
    description: 'Whether an account can be created with the code given, or with no code at all',
  })
  allowed!: boolean;

  @ApiProperty({
    description:
      'Whether a valid invitation code would still open sign-up when `allowed` is false: true on an ' +
      'invitation-only instance, false when sign-up is closed to everyone (a demo instance)',
  })
  requiresCode!: boolean;

  @ApiPropertyOptional({ description: 'Why registration is refused, when it is' })
  message?: string;
}
