import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:test_demo_app/domain/services/secure_storage_service.dart';
import 'package:test_demo_app/features/theme_settings/cubit/theme_settings_cubit.dart';
import 'package:test_demo_app/features/theme_settings/cubit/theme_settings_state.dart';

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

void main() {
  late _MockISecureStorageService mockISecureStorageService;
  late ThemeSettingsCubit theme_settings_cubit;

  setUp(() {
    mockISecureStorageService = _MockISecureStorageService();
    theme_settings_cubit =
        ThemeSettingsCubit(secureStorage: mockISecureStorageService);
  });

  tearDown(() {
    theme_settings_cubit.close();
  });

  group('Тесты для ThemeSettingsCubit', () {
    test(
      'Проверка начального состояния',
      () {
        expect(
          theme_settings_cubit.state,
          const ThemeInitialState(),
        );
      },
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'setLightTheme_to_ThemeLightState_test_1: setLightTheme должен эмитировать ThemeLightState',
      build: () {
        return theme_settings_cubit;
      },
      act: (cubit) => cubit.setLightTheme(),
      expect: () => [const ThemeLightState()],
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'setDarkTheme_to_ThemeDarkState_test_1: setDarkTheme должен эмитировать ThemeDarkState',
      build: () {
        return theme_settings_cubit;
      },
      act: (cubit) => cubit.setDarkTheme(),
      expect: () => [const ThemeDarkState()],
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'setSystemTheme_to_ThemeSystemState_test_1: setSystemTheme должен эмитировать ThemeSystemState',
      build: () {
        return theme_settings_cubit;
      },
      act: (cubit) => cubit.setSystemTheme(),
      expect: () => [const ThemeSystemState()],
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'resetTheme_to_ThemeInitialState_test_1: resetTheme должен эмитировать ThemeInitialState',
      build: () {
        return theme_settings_cubit;
      },
      act: (cubit) => cubit.resetTheme(),
      expect: () => [const ThemeInitialState()],
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'loadSavedTheme_to_ThemeLightState_test_2: loadSavedTheme должен эмитировать ThemeLoadingState -> ThemeLightState',
      build: () {
        // Mock setups для маршрута теста
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'light');

        return theme_settings_cubit;
      },
      act: (cubit) => cubit.loadSavedTheme(),
      expect: () => [const ThemeLoadingState(), const ThemeLightState()],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'loadSavedTheme_to_ThemeDarkState_test_3: loadSavedTheme должен эмитировать ThemeLoadingState -> ThemeDarkState',
      build: () {
        // Mock setups для маршрута теста
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'dark');

        return theme_settings_cubit;
      },
      act: (cubit) => cubit.loadSavedTheme(),
      expect: () => [const ThemeLoadingState(), const ThemeDarkState()],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'loadSavedTheme_to_ThemeSystemState_test_4: loadSavedTheme должен эмитировать ThemeLoadingState -> ThemeSystemState',
      build: () {
        // Mock setups для маршрута теста
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'system');

        return theme_settings_cubit;
      },
      act: (cubit) => cubit.loadSavedTheme(),
      expect: () => [const ThemeLoadingState(), const ThemeSystemState()],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'loadSavedTheme_to_ThemeInitialState_test_5: loadSavedTheme должен эмитировать ThemeLoadingState -> ThemeInitialState',
      build: () {
        // Mock setups для маршрута теста
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'test_stored_value');

        return theme_settings_cubit;
      },
      act: (cubit) => cubit.loadSavedTheme(),
      expect: () => [const ThemeLoadingState(), const ThemeInitialState()],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'multiple_test_1_setLightTheme_resetTheme: последовательность setLightTheme -> resetTheme',
      build: () {
        return theme_settings_cubit;
      },
      act: (cubit) async {
        cubit.setLightTheme();
        cubit.resetTheme();
      },
      expect: () => [ThemeLightState(), ThemeInitialState()],
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'multiple_test_2_setLightTheme_loadSavedTheme: последовательность setLightTheme -> loadSavedTheme',
      build: () {
        // Combined mock setups from both tests
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'test_stored_value');

        return theme_settings_cubit;
      },
      act: (cubit) async {
        cubit.setLightTheme();
        cubit.loadSavedTheme();
      },
      expect: () =>
          [ThemeLightState(), ThemeLoadingState(), ThemeInitialState()],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'multiple_test_3_setDarkTheme_resetTheme: последовательность setDarkTheme -> resetTheme',
      build: () {
        return theme_settings_cubit;
      },
      act: (cubit) async {
        cubit.setDarkTheme();
        cubit.resetTheme();
      },
      expect: () => [ThemeDarkState(), ThemeInitialState()],
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'multiple_test_4_setDarkTheme_loadSavedTheme: последовательность setDarkTheme -> loadSavedTheme',
      build: () {
        // Combined mock setups from both tests
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'test_stored_value');

        return theme_settings_cubit;
      },
      act: (cubit) async {
        cubit.setDarkTheme();
        cubit.loadSavedTheme();
      },
      expect: () =>
          [ThemeDarkState(), ThemeLoadingState(), ThemeInitialState()],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
    blocTest<ThemeSettingsCubit, ThemeSettingsState>(
      'multiple_test_5_setSystemTheme_resetTheme: последовательность setSystemTheme -> resetTheme',
      build: () {
        return theme_settings_cubit;
      },
      act: (cubit) async {
        cubit.setSystemTheme();
        cubit.resetTheme();
      },
      expect: () => [ThemeSystemState(), ThemeInitialState()],
    );
  });
}
