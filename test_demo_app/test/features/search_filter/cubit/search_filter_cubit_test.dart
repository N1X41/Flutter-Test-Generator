import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:test_demo_app/domain/services/secure_storage_service.dart';
import 'package:test_demo_app/features/search_filter/cubit/search_filter_cubit.dart';
import 'package:test_demo_app/features/search_filter/cubit/search_filter_state.dart';

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
  late SearchFilterCubit search_filter_cubit;

  setUp(() {
    mockISecureStorageService = _MockISecureStorageService();
    search_filter_cubit =
        SearchFilterCubit(secureStorage: mockISecureStorageService);
  });

  tearDown(() {
    search_filter_cubit.close();
  });

  group('Тесты для SearchFilterCubit', () {
    test(
      'Проверка начального состояния',
      () {
        expect(
          search_filter_cubit.state,
          const SearchFilterInitialState(),
        );
      },
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'clearFilters_to_SearchFilterClearedState_test_1: clearFilters должен эмитировать SearchFilterClearedState',
      build: () {
        return search_filter_cubit;
      },
      act: (cubit) => cubit.clearFilters(),
      expect: () => [const SearchFilterClearedState()],
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'resetToInitial_to_SearchFilterInitialState_test_1: resetToInitial должен эмитировать SearchFilterInitialState',
      build: () {
        return search_filter_cubit;
      },
      act: (cubit) => cubit.resetToInitial(),
      expect: () => [const SearchFilterInitialState()],
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'applyFilters_to_SearchFilterAppliedState_test_1: applyFilters должен эмитировать SearchFilterAppliedState',
      build: () {
        return search_filter_cubit;
      },
      act: (cubit) => cubit.applyFilters(),
      expect: () => [const SearchFilterAppliedState()],
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'loadSavedFilters_to_SearchFilterAppliedState_test_2: loadSavedFilters должен эмитировать SearchFilterLoadingState -> SearchFilterAppliedState',
      build: () {
        // Mock setups для маршрута теста
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'test_stored_value');

        return search_filter_cubit;
      },
      act: (cubit) => cubit.loadSavedFilters(),
      expect: () =>
          [const SearchFilterLoadingState(), const SearchFilterAppliedState()],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'loadSavedFilters_to_SearchFilterInitialState_test_3: loadSavedFilters должен эмитировать SearchFilterLoadingState -> SearchFilterInitialState',
      build: () {
        // Mock setups для маршрута теста
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'test_stored_value');

        return search_filter_cubit;
      },
      act: (cubit) => cubit.loadSavedFilters(),
      expect: () =>
          [const SearchFilterLoadingState(), const SearchFilterInitialState()],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'addFilter_to_SearchFilterAppliedState_test_1: addFilter должен эмитировать SearchFilterAppliedState',
      build: () {
        return search_filter_cubit;
      },
      act: (cubit) => cubit.addFilter(),
      expect: () => [const SearchFilterAppliedState()],
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'multiple_test_1_clearFilters_resetToInitial: последовательность clearFilters -> resetToInitial',
      build: () {
        return search_filter_cubit;
      },
      act: (cubit) async {
        cubit.clearFilters();
        cubit.resetToInitial();
      },
      expect: () => [SearchFilterClearedState(), SearchFilterInitialState()],
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'multiple_test_2_clearFilters_loadSavedFilters: последовательность clearFilters -> loadSavedFilters',
      build: () {
        // Combined mock setups from both tests
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'test_stored_value');

        return search_filter_cubit;
      },
      act: (cubit) async {
        cubit.clearFilters();
        cubit.loadSavedFilters();
      },
      expect: () => [
        SearchFilterClearedState(),
        SearchFilterLoadingState(),
        SearchFilterInitialState()
      ],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'multiple_test_3_resetToInitial_applyFilters: последовательность resetToInitial -> applyFilters',
      build: () {
        return search_filter_cubit;
      },
      act: (cubit) async {
        cubit.resetToInitial();
        cubit.applyFilters();
      },
      expect: () => [SearchFilterInitialState(), SearchFilterAppliedState()],
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'multiple_test_4_resetToInitial_loadSavedFilters: последовательность resetToInitial -> loadSavedFilters',
      build: () {
        // Combined mock setups from both tests
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'test_stored_value');

        return search_filter_cubit;
      },
      act: (cubit) async {
        cubit.resetToInitial();
        cubit.loadSavedFilters();
      },
      expect: () => [
        SearchFilterInitialState(),
        SearchFilterLoadingState(),
        SearchFilterAppliedState()
      ],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
    blocTest<SearchFilterCubit, SearchFilterState>(
      'multiple_test_5_resetToInitial_loadSavedFilters: последовательность resetToInitial -> loadSavedFilters',
      build: () {
        // Combined mock setups from both tests
        when(() => mockISecureStorageService.read(any()))
            .thenAnswer((_) async => 'test_stored_value');

        return search_filter_cubit;
      },
      act: (cubit) async {
        cubit.resetToInitial();
        cubit.loadSavedFilters();
      },
      expect: () => [
        SearchFilterInitialState(),
        SearchFilterLoadingState(),
        SearchFilterInitialState()
      ],
      verify: (_) {
        verify(() => mockISecureStorageService.read(any())).called(1);
      },
    );
  });
}
