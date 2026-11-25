import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength, IsArray, ArrayMinSize, ArrayMaxSize, IsMongoId } from 'class-validator';

export class RegisterDto { @IsString() @Length(2, 80) name!: string; @IsEmail() email!: string; @IsString() @Length(8, 128) password!: string; }
export class LoginDto { @IsEmail() email!: string; @IsString() @IsNotEmpty() password!: string; }
export class ChatDto { @IsString() @Length(2, 4000) message!: string; @IsOptional() @IsMongoId() conversationId?: string; @IsOptional() @IsArray() @ArrayMaxSize(8) @IsMongoId({ each: true }) documentIds?: string[]; }
export class CompareDto { @IsArray() @ArrayMinSize(2) @ArrayMaxSize(4) @IsString({ each: true }) models!: string[]; @IsOptional() @IsString() @MaxLength(500) focus?: string; }
export class RecommendDto { @IsString() @Length(5, 2000) requirements!: string; }
