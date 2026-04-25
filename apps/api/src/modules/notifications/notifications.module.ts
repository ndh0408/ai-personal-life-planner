import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationTemplateService } from './notification-template.service';
import { ExpoNotificationProvider } from './expo-notification.provider';
import { NotificationWorkerService } from './notification-worker.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatcherService,
    NotificationTemplateService,
    ExpoNotificationProvider,
    NotificationWorkerService,
  ],
  exports: [NotificationsService, NotificationDispatcherService, NotificationTemplateService],
})
export class NotificationsModule {}
