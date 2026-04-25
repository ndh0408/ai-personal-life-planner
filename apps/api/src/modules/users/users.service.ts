import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        // Round-18: mobile email-verify banner reads this. Null ⇒ unverified.
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            fullName: true,
            age: true,
            gender: true,
            heightCm: true,
            weightKg: true,
            occupation: true,
            mainGoal: true,
            activityLevel: true,
            dietaryPreference: true,
            timezone: true,
            locale: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
