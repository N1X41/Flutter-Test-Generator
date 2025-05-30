import 'package:equatable/equatable.dart';

/// Базовое состояние для фильтров поиска
abstract class SearchFilterState extends Equatable {
  const SearchFilterState();

  @override
  List<Object?> get props => [];
}

/// Начальное состояние фильтров
class SearchFilterInitialState extends SearchFilterState {
  const SearchFilterInitialState();
}

/// Фильтры применены
class SearchFilterAppliedState extends SearchFilterState {
  final Map<String, dynamic> filters;
  final int activeFiltersCount;

  const SearchFilterAppliedState({
    required this.filters,
    required this.activeFiltersCount,
  });

  @override
  List<Object?> get props => [filters, activeFiltersCount];
}

/// Фильтры сброшены
class SearchFilterClearedState extends SearchFilterState {
  const SearchFilterClearedState();
}

/// Состояние загрузки фильтров
class SearchFilterLoadingState extends SearchFilterState {
  const SearchFilterLoadingState();
}

/// Состояние сохранения фильтров
class SearchFilterSavingState extends SearchFilterState {
  final Map<String, dynamic> currentFilters;

  const SearchFilterSavingState({
    required this.currentFilters,
  });

  @override
  List<Object?> get props => [currentFilters];
} 