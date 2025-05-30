import 'package:equatable/equatable.dart';

/// Базовое событие для авторизации
abstract class AuthLoginEvent extends Equatable {
  const AuthLoginEvent();

  @override
  List<Object?> get props => [];
}

/// Событие авторизации пользователя
class AuthLoginUserEvent extends AuthLoginEvent {
  final String email;
  final String password;
  final bool rememberMe;

  const AuthLoginUserEvent({
    required this.email,
    required this.password,
    this.rememberMe = false,
  });

  @override
  List<Object?> get props => [email, password, rememberMe];
}

/// Событие валидации email
class AuthValidateEmailEvent extends AuthLoginEvent {
  final String email;

  const AuthValidateEmailEvent(this.email);

  @override
  List<Object?> get props => [email];
}

/// Событие валидации пароля
class AuthValidatePasswordEvent extends AuthLoginEvent {
  final String password;

  const AuthValidatePasswordEvent(this.password);

  @override
  List<Object?> get props => [password];
}

/// Событие сброса состояния
class AuthResetStateEvent extends AuthLoginEvent {
  const AuthResetStateEvent();
}

/// Событие выхода из системы
class AuthLogoutEvent extends AuthLoginEvent {
  const AuthLogoutEvent();
} 