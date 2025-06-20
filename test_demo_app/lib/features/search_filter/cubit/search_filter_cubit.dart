import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:test_demo_app/domain/services/secure_storage_service.dart';
import 'search_filter_state.dart';

/// Кубит для управления фильтрами поиска
class SearchFilterCubit extends Cubit<SearchFilterState> {
  final ISecureStorageService _secureStorage;

  SearchFilterCubit({
    required ISecureStorageService secureStorage,
  })  : _secureStorage = secureStorage,
        super(const SearchFilterInitialState());

  /// Сбрасывает все фильтры
  void clearFilters() => emit(const SearchFilterClearedState());

  /// Сбрасывает к начальному состоянию
  void resetToInitial() => emit(const SearchFilterInitialState());

  /// Применяет фильтры
  void applyFilters(Map<String, dynamic> filters) {
    final activeCount = _countActiveFilters(filters);
    emit(SearchFilterAppliedState(
      filters: filters,
      activeFiltersCount: activeCount,
    ));
  }

  /// Загружает сохраненные фильтры
  Future<void> loadSavedFilters() async {
    emit(const SearchFilterLoadingState());

    try {
      final savedFilters = await _secureStorage.read('search_filters');

      if (savedFilters != null && savedFilters.isNotEmpty) {
        // Парсим сохраненные фильтры (упрощенная версия)
        final filters = _parseFiltersFromString(savedFilters);
        final activeCount = _countActiveFilters(filters);

        emit(SearchFilterAppliedState(
          filters: filters,
          activeFiltersCount: activeCount,
        ));
      } else {
        emit(const SearchFilterInitialState());
      }
    } catch (error) {
      emit(const SearchFilterInitialState());
    }
  }

  /// Добавляет один фильтр к существующим
  Future<void> addFilter(String key, dynamic value) async {
    Map<String, dynamic> currentFilters = {};

    if (state is SearchFilterAppliedState) {
      final currentState = state as SearchFilterAppliedState;
      currentFilters = Map<String, dynamic>.from(currentState.filters);
    }

    currentFilters[key] = value;
    final activeCount = _countActiveFilters(currentFilters);

    emit(SearchFilterAppliedState(
      filters: currentFilters,
      activeFiltersCount: activeCount,
    ));
  }

  /// Приватный метод для подсчета активных фильтров
  int _countActiveFilters(Map<String, dynamic> filters) {
    return filters.values
        .where((value) =>
            value != null &&
            value != '' &&
            (value is! List || (value as List).isNotEmpty))
        .length;
  }

  /// Приватный метод для парсинга фильтров из строки
  Map<String, dynamic> _parseFiltersFromString(String filtersString) {
    // Упрощенная реализация парсинга
    final Map<String, dynamic> filters = {};

    try {
      final parts = filtersString.split('|');
      for (final part in parts) {
        final keyValue = part.split(':');
        if (keyValue.length == 2) {
          filters[keyValue[0]] = keyValue[1];
        }
      }
    } catch (error) {
      // Возвращаем пустые фильтры в случае ошибки парсинга
    }

    return filters;
  }

  /// Приватный метод для сохранения фильтров в хранилище
  Future<void> _saveFiltersToStorage(Map<String, dynamic> filters) async {
    final filtersString =
        filters.entries.map((entry) => '${entry.key}:${entry.value}').join('|');

    await _secureStorage.write('search_filters', filtersString);
    await _secureStorage.write(
        'filters_save_time', DateTime.now().toIso8601String());
  }
}
