import { Injectable } from '@nestjs/common';

@Injectable()
export class GoalsService {
  async list(_userId: string) {
    return {
      items: [],
      notImplemented: true,
    };
  }
}
