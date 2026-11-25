import { BadRequestException, Body, CanActivate, ConflictException, Controller, ExecutionContext, Get, Injectable, Post, UnauthorizedException, UseGuards, createParamDecorator } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto } from './dto';

export type AuthRequest = { user: { id: string; email: string; role: string } };
export const ReqUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!match) throw new UnauthorizedException('Authentication required');
    try { req.user = await this.jwt.verifyAsync(match[1]); return true; }
    catch { throw new UnauthorizedException('Invalid or expired token'); }
  }
}

@Controller('auth')
export class AuthController {
  constructor(@InjectModel('User') private users: Model<any>, private jwt: JwtService) {}
  private result(user: any) { return { token: this.jwt.sign({ id: String(user._id), email: user.email, role: user.role }), user: { id: String(user._id), name: user.name, email: user.email, role: user.role } }; }
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.users.exists({ email })) throw new ConflictException('Email is already registered');
    try { const user = await this.users.create({ name: dto.name.trim(), email, passwordHash: await bcrypt.hash(dto.password, 12) }); return this.result(user); }
    catch (err: any) { if (err.code === 11000) throw new ConflictException('Email is already registered'); throw err; }
  }
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.users.findOne({ email: dto.email.toLowerCase().trim() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) throw new UnauthorizedException('Invalid email or password');
    return this.result(user);
  }
  @Get('profile') @UseGuards(AuthGuard)
  async profile(@ReqUser() user: AuthRequest['user']) {
    const record = await this.users.findById(user.id).select('name email role');
    if (!record) throw new BadRequestException('Account no longer exists');
    return { id: String(record._id), name: record.name, email: record.email, role: record.role };
  }
}

