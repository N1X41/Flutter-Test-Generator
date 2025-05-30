import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:test_demo_app/domain/services/notification_service.dart';
import 'package:test_demo_app/domain/services/secure_storage_service.dart';
import 'package:test_demo_app/features/notification_toggle/cubit/notification_toggle_cubit.dart';
import 'package:test_demo_app/features/notification_toggle/cubit/notification_toggle_state.dart';

// Функция для генерации тестовых данных
dynamic generateTestData() {
  return <String, dynamic>{
    'id': 1,
    'data': 'test data',
    'timestamp': DateTime.now().toIso8601String(),
  };
}

class _MockISecureStorageService extends Mock
    implements ISecureStorageService {}

class _MockINotificationService extends Mock implements INotificationService {}

void main() {
  late _MockISecureStorageService mockISecureStorageService;
  late _MockINotificationService mockINotificationService;
  late NotificationToggleCubit notification_toggle_cubit;

  setUp(() {
    mockISecureStorageService = _MockISecureStorageService();
    mockINotificationService = _MockINotificationService();
    notification_toggle_cubit = NotificationToggleCubit(
        secureStorage: mockISecureStorageService,
        notificationService: mockINotificationService);
  });

  tearDown(() {
    notification_toggle_cubit.close();
  });

  group('Тесты для NotificationToggleCubit', () {
    test(
      'Проверка начального состояния',
      () {
        expect(
          notification_toggle_cubit.state,
          const NotificationInitialState(),
        );
      },
    );
    blocTest<NotificationToggleCubit, NotificationToggleState>(
      'enableNotifications_to_NotificationEnabledState_test_1: enableNotifications должен эмитировать NotificationEnabledState',
      build: () {
        return notification_toggle_cubit;
      },
      act: (cubit) => cubit.enableNotifications(),
      expect: () => [const NotificationEnabledState()],
    );
    blocTest<NotificationToggleCubit, NotificationToggleState>(
      'disableNotifications_to_NotificationDisabledState_test_1: disableNotifications должен эмитировать NotificationDisabledState',
      build: () {
        return notification_toggle_cubit;
      },
      act: (cubit) => cubit.disableNotifications(),
      expect: () => [const NotificationDisabledState()],
    );
    blocTest<NotificationToggleCubit, NotificationToggleState>(
      'enablePushOnly_to_NotificationPushEnabledState_test_1: enablePushOnly должен эмитировать NotificationPushEnabledState',
      build: () {
        return notification_toggle_cubit;
      },
      act: (cubit) => cubit.enablePushOnly(),
      expect: () => [const NotificationPushEnabledState()],
    );
    blocTest<NotificationToggleCubit, NotificationToggleState>(
      'enableEmailOnly_to_NotificationEmailEnabledState_test_1: enableEmailOnly должен эмитировать NotificationEmailEnabledState',
      build: () {
        return notification_toggle_cubit;
      },
      act: (cubit) => cubit.enableEmailOnly(),
      expect: () => [const NotificationEmailEnabledState()],
    );
    blocTest<NotificationToggleCubit, NotificationToggleState>(
      'resetNotifications_to_NotificationInitialState_test_1: resetNotifications должен эмитировать NotificationInitialState',
      build: () {
        return notification_toggle_cubit;
      },
      act: (cubit) => cubit.resetNotifications(),
      expect: () => [const NotificationInitialState()],
    );
    blocTest<NotificationToggleCubit, NotificationToggleState>(
      'multiple_test_1_enableNotifications_disableNotifications: последовательность enableNotifications -> disableNotifications',
      build: () {
        return notification_toggle_cubit;
      },
      act: (cubit) async {
        cubit.enableNotifications();
        cubit.disableNotifications();
      },
      expect: () => [NotificationEnabledState(), NotificationDisabledState()],
    );
    blocTest<NotificationToggleCubit, NotificationToggleState>(
      'multiple_test_2_enableNotifications_enablePushOnly: последовательность enableNotifications -> enablePushOnly',
      build: () {
        return notification_toggle_cubit;
      },
      act: (cubit) async {
        cubit.enableNotifications();
        cubit.enablePushOnly();
      },
      expect: () =>
          [NotificationEnabledState(), NotificationPushEnabledState()],
    );
    blocTest<NotificationToggleCubit, NotificationToggleState>(
      'multiple_test_3_enableNotifications_enableEmailOnly: последовательность enableNotifications -> enableEmailOnly',
      build: () {
        return notification_toggle_cubit;
      },
      act: (cubit) async {
        cubit.enableNotifications();
        cubit.enableEmailOnly();
      },
      expect: () =>
          [NotificationEnabledState(), NotificationEmailEnabledState()],
    );
    blocTest<NotificationToggleCubit, NotificationToggleState>(
      'multiple_test_4_enableNotifications_resetNotifications: последовательность enableNotifications -> resetNotifications',
      build: () {
        return notification_toggle_cubit;
      },
      act: (cubit) async {
        cubit.enableNotifications();
        cubit.resetNotifications();
      },
      expect: () => [NotificationEnabledState(), NotificationInitialState()],
    );
    blocTest<NotificationToggleCubit, NotificationToggleState>(
      'multiple_test_5_disableNotifications_enablePushOnly: последовательность disableNotifications -> enablePushOnly',
      build: () {
        return notification_toggle_cubit;
      },
      act: (cubit) async {
        cubit.disableNotifications();
        cubit.enablePushOnly();
      },
      expect: () =>
          [NotificationDisabledState(), NotificationPushEnabledState()],
    );
  });
}
