import 'package:equatable/equatable.dart';

/// Базовое состояние для настроек темы
abstract class ThemeSettingsState extends Equatable {
  const ThemeSettingsState();

  @override
  List<Object?> get props => [];
}

/// Начальное состояние темы
class ThemeInitialState extends ThemeSettingsState {
  const ThemeInitialState();
}

/// Светлая тема
class ThemeLightState extends ThemeSettingsState {
  const ThemeLightState();
}

/// Темная тема
class ThemeDarkState extends ThemeSettingsState {
  const ThemeDarkState();
}

/// Системная тема
class ThemeSystemState extends ThemeSettingsState {
  const ThemeSystemState();
}

/// Состояние загрузки настроек темы
class ThemeLoadingState extends ThemeSettingsState {
  const ThemeLoadingState();
} 