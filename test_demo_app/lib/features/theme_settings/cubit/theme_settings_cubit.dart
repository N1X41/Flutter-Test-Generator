import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:test_demo_app/domain/services/secure_storage_service.dart';
import 'theme_settings_state.dart';

/// Кубит для управления настройками темы приложения
class ThemeSettingsCubit extends Cubit<ThemeSettingsState> {
  final ISecureStorageService _secureStorage;

  ThemeSettingsCubit({
    required ISecureStorageService secureStorage,
  })  : _secureStorage = secureStorage,
        super(const ThemeInitialState());

  /// Устанавливает светлую тему
  void setLightTheme() => emit(const ThemeLightState());

  /// Устанавливает темную тему
  void setDarkTheme() => emit(const ThemeDarkState());

  /// Устанавливает системную тему
  void setSystemTheme() => emit(const ThemeSystemState());

  /// Сбрасывает тему к начальному состоянию
  void resetTheme() => emit(const ThemeInitialState());

  /// Загружает сохраненную тему из хранилища
  Future<void> loadSavedTheme() async {
    emit(const ThemeLoadingState());
    
    try {
      final savedTheme = await _secureStorage.read('theme_preference');
      
      switch (savedTheme) {
        case 'light':
          emit(const ThemeLightState());
          break;
        case 'dark':
          emit(const ThemeDarkState());
          break;
        case 'system':
          emit(const ThemeSystemState());
          break;
        default:
          emit(const ThemeInitialState());
      }
    } catch (error) {
      emit(const ThemeInitialState());
    }
  }

  /// Сохраняет текущую тему в хранилище
  Future<void> saveCurrentTheme() async {
    String themeValue = 'initial';
    
    if (state is ThemeLightState) {
      themeValue = 'light';
    } else if (state is ThemeDarkState) {
      themeValue = 'dark';
    } else if (state is ThemeSystemState) {
      themeValue = 'system';
    }
    
    await _secureStorage.write('theme_preference', themeValue);
  }
} 