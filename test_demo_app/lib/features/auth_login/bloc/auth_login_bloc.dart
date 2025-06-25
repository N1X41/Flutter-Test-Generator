import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:test_demo_app/domain/repositories/auth_repository.dart';
import 'package:test_demo_app/domain/services/secure_storage_service.dart';
import 'auth_login_event.dart';
import 'auth_login_state.dart';

/// Блок для управления авторизацией пользователя
class AuthLoginBloc extends Bloc<AuthLoginEvent, AuthLoginState> {
  final IAuthRepository _authRepository;
  final ISecureStorageService _secureStorage;

  AuthLoginBloc({
    required IAuthRepository authRepository,
    required ISecureStorageService secureStorage,
  })  : _authRepository = authRepository,
        _secureStorage = secureStorage,
        super(const AuthInitialLoginState()) {
    
    on<AuthLoginUserEvent>(_onPerformAuthorization);
    on<AuthValidateEmailEvent>(_onValidateEmail);
    on<AuthValidatePasswordEvent>(_onValidatePassword);
    on<AuthResetStateEvent>(_onResetState);
    on<AuthLogoutEvent>(_onLogout);
  }

  /// Обработчик события авторизации пользователя
  Future<void> _onPerformAuthorization(
    AuthLoginUserEvent event,
    Emitter<AuthLoginState> emit,
  ) async {
    // Guard условие - не выполняем если уже загружаемся
    if (state is AuthLoadingLoginState) return;

    emit(const AuthLoadingLoginState());

    try {
      // Выполняем авторизацию через репозиторий
      final loginData = await _authRepository.performAuthorization(
        email: event.email.trim(),
        password: event.password.trim(),
      );

      // Сохраняем данные авторизации если нужно запомнить
      if (event.rememberMe) {
        await _writeLoginData(data: loginData);
      }

      emit(const AuthSuccessLoginState());
    } on AuthException catch (error, stackTrace) {
      emit(AuthErrorLoginState(
        message: error.message,
        errorCode: error.code,
      ));
      addError(error, stackTrace);
    } on Object catch (error, stackTrace) {
      final authError = AuthException.fromError(
        error: error,
        stackTrace: stackTrace,
      );
      emit(AuthErrorLoginState(
        message: authError.message,
        errorCode: authError.code,
      ));
      addError(error, stackTrace);
    }
  }

  /// Обработчик валидации email
  Future<void> _onValidateEmail(
    AuthValidateEmailEvent event,
    Emitter<AuthLoginState> emit,
  ) async {
    final email = event.email.trim();
    final isValid = _isValidEmail(email);
    
    emit(AuthValidationLoginState(
      isEmailValid: isValid,
      isPasswordValid: true, // Предполагаем что пароль валиден
      emailError: isValid ? null : 'Некорректный email адрес',
    ));
  }

  /// Обработчик валидации пароля
  Future<void> _onValidatePassword(
    AuthValidatePasswordEvent event,
    Emitter<AuthLoginState> emit,
  ) async {
    final password = event.password;
    final isValid = _isValidPassword(password);
    
    emit(AuthValidationLoginState(
      isEmailValid: true, // Предполагаем что email валиден
      isPasswordValid: isValid,
      passwordError: isValid ? null : 'Пароль должен содержать минимум 6 символов',
    ));
  }

  /// Обработчик сброса состояния
  Future<void> _onResetState(
    AuthResetStateEvent event,
    Emitter<AuthLoginState> emit,
  ) async {
    emit(const AuthInitialLoginState());
  }

  /// Обработчик выхода из системы
  Future<void> _onLogout(
    AuthLogoutEvent event,
    Emitter<AuthLoginState> emit,
  ) async {
    if (state is AuthLoadingLoginState) return;

    emit(const AuthLoadingLoginState());

    try {
      await _authRepository.logout();
      await _secureStorage.deleteAll();
      emit(const AuthInitialLoginState());
    } catch (error, stackTrace) {
      emit(const AuthErrorLoginState(
        message: 'Ошибка при выходе из системы',
      ));
      addError(error, stackTrace);
    }
  }

  /// Приватный метод для сохранения данных авторизации
  Future<void> _writeLoginData({required Map<String, dynamic> data}) async {
    await _secureStorage.write('access_token', data['accessToken'] ?? '');
    await _secureStorage.write('refresh_token', data['refreshToken'] ?? '');
    await _secureStorage.write('user_id', data['userId'] ?? '');
  }

  /// Валидация email адреса
  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  /// Валидация пароля
  bool _isValidPassword(String password) {
    return password.length >= 6;
  }
}

/// Исключение для ошибок авторизации
class AuthException implements Exception {
  final String message;
  final int code;

  const AuthException({
    required this.message,
    required this.code,
  });

  factory AuthException.fromError({
    required Object error,
    required StackTrace stackTrace,
  }) {
    return AuthException(
      message: error.toString(),
      code: 500,
    );
  }
} 