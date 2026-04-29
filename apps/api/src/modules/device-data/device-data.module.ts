import { Module } from '@nestjs/common';
import { DeviceDataController } from './device-data.controller';
import { DeviceDataService } from './device-data.service';
import { SleepInferenceService } from './sleep-inference.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [IntelligenceModule],
  controllers: [DeviceDataController],
  providers: [DeviceDataService, SleepInferenceService],
  exports: [DeviceDataService, SleepInferenceService],
})
export class DeviceDataModule {}
