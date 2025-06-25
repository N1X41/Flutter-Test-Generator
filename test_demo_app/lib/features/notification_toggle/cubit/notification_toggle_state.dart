import 'package:equatable/equatable.dart';

/// Базовое состояние для управления уведомлениями
abstract class NotificationToggleState extends Equatable {
  const NotificationToggleState();

  @override
  List<Object?> get props => [];
}

/// Начальное состояние уведомлений
class NotificationInitialState extends NotificationToggleState {
  const NotificationInitialState();
}

/// Уведомления включены
class NotificationEnabledState extends NotificationToggleState {
  const NotificationEnabledState();
}

/// Уведомления отключены
class NotificationDisabledState extends NotificationToggleState {
  const NotificationDisabledState();
}

/// Push уведомления включены
class NotificationPushEnabledState extends NotificationToggleState {
  const NotificationPushEnabledState();
}

/// Email уведомления включены
class NotificationEmailEnabledState extends NotificationToggleState {
  const NotificationEmailEnabledState();
}

/// Состояние загрузки настроек уведомлений
class NotificationLoadingState extends NotificationToggleState {
  const NotificationLoadingState();
} 