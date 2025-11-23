import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { LoginDTO } from '@shared';

@Injectable()
export class AppService {
  constructor(private readonly jwtService: JwtService) {}

  login(credentials: LoginDTO) {
    if (
      credentials.email === 'uzair.muaz3k@gmail.com' &&
      credentials.password === 'Qwerty123!!'
    ) {
      const payload = { id: 123, email: credentials.email, role: 'Admin' };
      const token = this.jwtService.sign(payload);
      return token;
    }
    // throw new UnauthorizedException('Invalid credentials');
    throw new RpcException({ status: 401, message: 'Invalid credentials' });
  }
}
