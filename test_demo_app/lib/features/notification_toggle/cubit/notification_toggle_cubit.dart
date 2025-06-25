import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:test_demo_app/domain/services/secure_storage_service.dart';
import 'package:test_demo_app/domain/services/notification_service.dart';
import 'notification_toggle_state.dart';

/// Кубит для управления настройками уведомлений
class NotificationToggleCubit extends Cubit<NotificationToggleState> {
  final ISecureStorageService _secureStorage;
  final INotificationService _notificationService;

  NotificationToggleCubit({
    required ISecureStorageService secureStorage,
    required INotificationService notificationService,
  })  : _secureStorage = secureStorage,
        _notificationService = notificationService,
        super(const NotificationInitialState());

  /// Включает все уведомления
  void enableNotifications() => emit(const NotificationEnabledState());

  /// Отключает все уведомления
  void disableNotifications() => emit(const NotificationDisabledState());

  /// Включает только push уведомления
  void enablePushOnly() => emit(const NotificationPushEnabledState());

  /// Включает только email уведомления
  void enableEmailOnly() => emit(const NotificationEmailEnabledState());

  /// Сбрасывает настройки к начальному состоянию
  void resetNotifications() => emit(const NotificationInitialState());

  /// Сохраняет текущие настройки уведомлений
  Future<void> saveNotificationSettings() async {
    String settingsValue = 'initial';
    
    if (state is NotificationEnabledState) {
      settingsValue = 'enabled';
      await _enableAllNotifications();
    } else if (state is NotificationDisabledState) {
      settingsValue = 'disabled';
      await _disableAllNotifications();
    } else if (state is NotificationPushEnabledState) {
      settingsValue = 'push_only';
      await _enablePushNotifications();
    } else if (state is NotificationEmailEnabledState) {
      settingsValue = 'email_only';
      await _enableEmailNotifications();
    }
    
    await _secureStorage.write('notification_settings', settingsValue);
  }

  /// Приватный метод для включения всех уведомлений
  Future<void> _enableAllNotifications() async {
    await _notificationService.initialize();
    final deviceToken = await _notificationService.getDeviceToken();
    if (deviceToken != null) {
      await _secureStorage.write('device_token', deviceToken);
    }
  }

  /// Приватный метод для отключения всех уведомлений
  Future<void> _disableAllNotifications() async {
    await _notificationService.cancelAllNotifications();
    await _secureStorage.delete('device_token');
  }

  /// Приватный метод для включения только push уведомлений
  Future<void> _enablePushNotifications() async {
    await _notificationService.initialize();
    final deviceToken = await _notificationService.getDeviceToken();
    if (deviceToken != null) {
      await _secureStorage.write('device_token', deviceToken);
    }
    await _secureStorage.write('email_notifications', 'disabled');
  }

  /// Приватный метод для включения только email уведомлений
  Future<void> _enableEmailNotifications() async {
    await _notificationService.cancelAllNotifications();
    await _secureStorage.delete('device_token');
    await _secureStorage.write('email_notifications', 'enabled');
  }
} 