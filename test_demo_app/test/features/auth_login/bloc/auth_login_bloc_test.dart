import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:test_demo_app/domain/repositories/auth_repository.dart';
import 'package:test_demo_app/domain/services/secure_storage_service.dart';
import 'package:test_demo_app/features/auth_login/bloc/auth_login_bloc.dart';
import 'package:test_demo_app/features/auth_login/bloc/auth_login_event.dart';
import 'package:test_demo_app/features/auth_login/bloc/auth_login_state.dart';

// Функция для генерации тестовых данных авторизации
dynamic generateTestData() {
  return {
    'accessToken': 'test_access_token_12345',
    'refreshToken': 'test_refresh_token_67890',
    'userId': 'test_user_123',
    'email': 'test@example.com',
  };
}

class _MockIAuthRepository extends Mock implements IAuthRepository {}

class _MockISecureStorageService extends Mock
    implements ISecureStorageService {}

void main() {
  late _MockIAuthRepository mockIAuthRepository;
  late _MockISecureStorageService mockISecureStorageService;
  late AuthLoginBloc auth_login_bloc;

  setUp(() {
    mockIAuthRepository = _MockIAuthRepository();
    mockISecureStorageService = _MockISecureStorageService();
    auth_login_bloc = AuthLoginBloc(
        authRepository: mockIAuthRepository,
        secureStorage: mockISecureStorageService);
  });

  tearDown(() {
    auth_login_bloc.close();
  });

  group('Тесты для AuthLoginBloc', () {
    test(
      'Проверка начального состояния',
      () {
        expect(
          auth_login_bloc.state,
          const AuthInitialLoginState(),
        );
      },
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'AuthLoginUserEvent_to_AuthSuccessLoginState_test_2: AuthLoginUserEvent должен эмитировать AuthLoadingLoginState -> AuthSuccessLoginState',
      build: () {
        // Mock setups для маршрута теста
        when(() => mockIAuthRepository.performAuthorization())
            .thenAnswer((_) async => 'test_success_data');

        return auth_login_bloc;
      },
      act: (cubit) => cubit.add(const AuthLoginUserEvent(
          email: "test@test.com", password: "password123")),
      expect: () =>
          [const AuthLoadingLoginState(), const AuthSuccessLoginState()],
      verify: (_) {
        verify(() => mockIAuthRepository.performAuthorization()).called(1);
      },
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'AuthLoginUserEvent_to_AuthErrorLoginState_test_3: AuthLoginUserEvent должен эмитировать AuthLoadingLoginState -> AuthErrorLoginState',
      build: () {
        // Mock setups для маршрута теста
        when(() => mockIAuthRepository.performAuthorization())
            .thenThrow(Exception('Test repository error'));

        return auth_login_bloc;
      },
      act: (cubit) => cubit.add(const AuthLoginUserEvent(
          email: "test@test.com", password: "password123")),
      expect: () =>
          [const AuthLoadingLoginState(), const AuthErrorLoginState()],
      verify: (_) {
        verify(() => mockIAuthRepository.performAuthorization()).called(1);
      },
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'AuthValidateEmailEvent_to_AuthValidationLoginState_test_1: AuthValidateEmailEvent должен эмитировать AuthValidationLoginState',
      build: () {
        return auth_login_bloc;
      },
      act: (cubit) => cubit.add(const AuthValidateEmailEvent()),
      expect: () => [const AuthValidationLoginState()],
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'AuthValidatePasswordEvent_to_AuthValidationLoginState_test_1: AuthValidatePasswordEvent должен эмитировать AuthValidationLoginState',
      build: () {
        return auth_login_bloc;
      },
      act: (cubit) => cubit.add(const AuthValidatePasswordEvent()),
      expect: () => [const AuthValidationLoginState()],
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'AuthResetStateEvent_to_AuthInitialLoginState_test_1: AuthResetStateEvent должен эмитировать AuthInitialLoginState',
      build: () {
        return auth_login_bloc;
      },
      act: (cubit) => cubit.add(const AuthResetStateEvent()),
      expect: () => [const AuthInitialLoginState()],
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'AuthLogoutEvent_to_AuthInitialLoginState_test_2: AuthLogoutEvent должен эмитировать AuthLoadingLoginState -> AuthInitialLoginState',
      build: () {
        // Mock setups для маршрута теста
        when(() => mockIAuthRepository.logout())
            .thenThrow(Exception('Test repository error'));
        when(() => mockISecureStorageService.delete()).thenAnswer((_) async {});

        return auth_login_bloc;
      },
      act: (cubit) => cubit.add(const AuthLogoutEvent()),
      expect: () =>
          [const AuthLoadingLoginState(), const AuthInitialLoginState()],
      verify: (_) {
        verify(() => mockIAuthRepository.logout()).called(1);
        verify(() => mockISecureStorageService.delete()).called(1);
      },
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'AuthLogoutEvent_to_AuthErrorLoginState_test_3: AuthLogoutEvent должен эмитировать AuthLoadingLoginState -> AuthErrorLoginState',
      build: () {
        // Mock setups для маршрута теста
        when(() => mockIAuthRepository.logout())
            .thenThrow(Exception('Test repository error'));
        when(() => mockISecureStorageService.delete()).thenAnswer((_) async {});

        return auth_login_bloc;
      },
      act: (cubit) => cubit.add(const AuthLogoutEvent()),
      expect: () =>
          [const AuthLoadingLoginState(), const AuthErrorLoginState()],
      verify: (_) {
        verify(() => mockIAuthRepository.logout()).called(1);
        verify(() => mockISecureStorageService.delete()).called(1);
      },
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'multiple_test_1_AuthLoginUserEvent_AuthValidateEmailEvent: последовательность AuthLoginUserEvent -> AuthValidateEmailEvent',
      build: () {
        // Combined mock setups from both tests
        when(() => mockIAuthRepository.performAuthorization())
            .thenAnswer((_) async => 'test_success_data');

        return auth_login_bloc;
      },
      act: (cubit) async {
        cubit.add(const AuthLoginUserEvent(
            email: "test@test.com", password: "password123"));
        cubit.add(const AuthValidateEmailEvent());
      },
      expect: () => [
        AuthLoadingLoginState(),
        AuthSuccessLoginState(),
        AuthValidationLoginState()
      ],
      verify: (_) {
        verify(() => mockIAuthRepository.performAuthorization()).called(1);
      },
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'multiple_test_2_AuthLoginUserEvent_AuthValidatePasswordEvent: последовательность AuthLoginUserEvent -> AuthValidatePasswordEvent',
      build: () {
        // Combined mock setups from both tests
        when(() => mockIAuthRepository.performAuthorization())
            .thenAnswer((_) async => 'test_success_data');

        return auth_login_bloc;
      },
      act: (cubit) async {
        cubit.add(const AuthLoginUserEvent(
            email: "test@test.com", password: "password123"));
        cubit.add(const AuthValidatePasswordEvent());
      },
      expect: () => [
        AuthLoadingLoginState(),
        AuthSuccessLoginState(),
        AuthValidationLoginState()
      ],
      verify: (_) {
        verify(() => mockIAuthRepository.performAuthorization()).called(1);
      },
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'multiple_test_3_AuthLoginUserEvent_AuthResetStateEvent: последовательность AuthLoginUserEvent -> AuthResetStateEvent',
      build: () {
        // Combined mock setups from both tests
        when(() => mockIAuthRepository.performAuthorization())
            .thenAnswer((_) async => 'test_success_data');

        return auth_login_bloc;
      },
      act: (cubit) async {
        cubit.add(const AuthLoginUserEvent(
            email: "test@test.com", password: "password123"));
        cubit.add(const AuthResetStateEvent());
      },
      expect: () => [
        AuthLoadingLoginState(),
        AuthSuccessLoginState(),
        AuthInitialLoginState()
      ],
      verify: (_) {
        verify(() => mockIAuthRepository.performAuthorization()).called(1);
      },
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'multiple_test_4_AuthLoginUserEvent_AuthLogoutEvent: последовательность AuthLoginUserEvent -> AuthLogoutEvent',
      build: () {
        // Combined mock setups from both tests
        when(() => mockIAuthRepository.performAuthorization())
            .thenAnswer((_) async => 'test_success_data');
        when(() => mockIAuthRepository.logout())
            .thenThrow(Exception('Test repository error'));
        when(() => mockISecureStorageService.delete()).thenAnswer((_) async {});

        return auth_login_bloc;
      },
      act: (cubit) async {
        cubit.add(const AuthLoginUserEvent(
            email: "test@test.com", password: "password123"));
        cubit.add(const AuthLogoutEvent());
      },
      expect: () => [
        AuthLoadingLoginState(),
        AuthSuccessLoginState(),
        AuthLoadingLoginState(),
        AuthInitialLoginState()
      ],
      verify: (_) {
        verify(() => mockIAuthRepository.performAuthorization()).called(1);
        verify(() => mockIAuthRepository.logout()).called(1);
        verify(() => mockISecureStorageService.delete()).called(1);
      },
    );
    blocTest<AuthLoginBloc, AuthLoginState>(
      'multiple_test_5_AuthLoginUserEvent_AuthLogoutEvent: последовательность AuthLoginUserEvent -> AuthLogoutEvent',
      build: () {
        // Combined mock setups from both tests
        when(() => mockIAuthRepository.performAuthorization())
            .thenAnswer((_) async => 'test_success_data');
        when(() => mockIAuthRepository.logout())
            .thenThrow(Exception('Test repository error'));
        when(() => mockISecureStorageService.delete()).thenAnswer((_) async {});

        return auth_login_bloc;
      },
      act: (cubit) async {
        cubit.add(const AuthLoginUserEvent(
            email: "test@test.com", password: "password123"));
        cubit.add(const AuthLogoutEvent());
      },
      expect: () => [
        AuthLoadingLoginState(),
        AuthSuccessLoginState(),
        AuthLoadingLoginState(),
        AuthErrorLoginState()
      ],
      verify: (_) {
        verify(() => mockIAuthRepository.performAuthorization()).called(1);
        verify(() => mockIAuthRepository.logout()).called(1);
        verify(() => mockISecureStorageService.delete()).called(1);
      },
    );
  });
}
