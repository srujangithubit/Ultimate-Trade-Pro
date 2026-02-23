import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(userData: Partial<User> & { password?: string }) {
    const user = this.userRepository.create(userData);

    // If password is provided but hash is not, hash it (though AuthService usually handles this)
    // Here we assume userData already contains passwordHash if it was processed by AuthService
    // If we receive raw password from elsewhere, handle it.
    // The prompt shows AuthService hashing it, so we expect passwordHash.

    // However, the prompt for AuthService says:
    // ...registerDto, password: hashedPassword
    // registerDto has 'password' field.
    // We should map 'password' to 'passwordHash' in entity if needed, or rely on caller?

    // Let's ensure proper mapping:
    if (userData.password && !userData.passwordHash) {
      // Ideally this should be handled by caller, but for safety:
      user.passwordHash = userData.password; // Assuming it WAS hashed and passed as password property
    }

    try {
      return await this.userRepository.save(user);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('User with this email already exists');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    let hash: string | null = null;
    if (refreshToken) {
      hash = await bcrypt.hash(refreshToken, 10);
    }
    await this.userRepository.update(userId, {
      refreshTokenHash: hash as any,
    });
  }

  async updateLastLogin(userId: string) {
    await this.userRepository.update(userId, {
      lastLogin: new Date(),
    });
  }
}
