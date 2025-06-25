import 'package:equatable/equatable.dart';

/// Базовое состояние для авторизации
abstract class AuthLoginState extends Equatable {
  const AuthLoginState();

  @override
  List<Object?> get props => [];
}

/// Начальное состояние авторизации
class AuthInitialLoginState extends AuthLoginState {
  const AuthInitialLoginState();
}

/// Состояние загрузки авторизации
class AuthLoadingLoginState extends AuthLoginState {
  const AuthLoadingLoginState();
}

/// Состояние успешной авторизации
class AuthSuccessLoginState extends AuthLoginState {
  const AuthSuccessLoginState();
}

/// Состояние ошибки авторизации
class AuthErrorLoginState extends AuthLoginState {
  final String message;
  final int? errorCode;

  const AuthErrorLoginState({
    required this.message,
    this.errorCode,
  });

  @override
  List<Object?> get props => [message, errorCode];
}

/// Состояние валидации формы
class AuthValidationLoginState extends AuthLoginState {
  final bool isEmailValid;
  final bool isPasswordValid;
  final String? emailError;
  final String? passwordError;

  const AuthValidationLoginState({
    required this.isEmailValid,
    required this.isPasswordValid,
    this.emailError,
    this.passwordError,
  });

  @override
  List<Object?> get props => [isEmailValid, isPasswordValid, emailError, passwordError];
} 