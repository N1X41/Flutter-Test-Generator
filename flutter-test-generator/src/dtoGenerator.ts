import * as vscode from 'vscode';
import * as path from 'path';
import { TextEncoder } from 'util';
import { toSnakeCase } from './utils';
import { parseImportsWithLexer } from './dartLexer';

/**
 * Интерфейс для хранения информации о полях DTO
 */
interface DataItem {
  dartName: string;  // Имя переменной в Dart-нотации
  jsonKey: string;   // Имя переменной в JSON-нотации
  type: string;      // Тип переменной
}

/**
 * Парсит метод fromJson и извлекает информацию о полях DTO
 * @param classCode - код класса DTO
 * @param dtoName - имя DTO класса
 * @returns массив объектов с информацией о полях
 */
function parseFromJson(classCode: string, dtoName: string): DataItem[] {
  const fromJsonRegex = new RegExp(`factory\\s+${dtoName}\\.fromJson\\s*\\(\\s*Map<String,\\s*dynamic>\\s*json\\s*\\)\\s*=>\\s*${dtoName}\\._\\s*\\(`, 's');
  const match = classCode.match(fromJsonRegex);
  if (!match) return [];

  const startIndex = match.index! + match[0].length;
  let braceCount = 1;
  let endIndex = startIndex;
  while (braceCount > 0 && endIndex < classCode.length) {
    if (classCode[endIndex] === '(') braceCount++;
    if (classCode[endIndex] === ')') braceCount--;
    endIndex++;
  }

  const paramsCode = classCode.substring(startIndex, endIndex - 1).trim();
  const params = paramsCode.split(',').map(param => param.trim()).filter(param => param);
  const dataItems: DataItem[] = [];

  for (const param of params) {
    const [dartName, jsonExpr] = param.split(':').map(p => p.trim());
    if (!jsonExpr) continue;
    const jsonKeyMatch = jsonExpr.match(/json\['([^']+)'\]/);
    const typeMatch = jsonExpr.match(/as\s+(\w+)/);
    if (jsonKeyMatch && typeMatch) {
      const jsonKey = jsonKeyMatch[1];
      const type = typeMatch[1];
      dataItems.push({ dartName, jsonKey, type });
    }
  }
  return dataItems;
}

/**
 * Ищет импорт entity класса в коде DTO файла через лексер
 * @param classCode - код DTO класса
 * @param entityName - имя entity класса
 * @returns путь импорта или null, если не найден
 */
function findEntityImportWithLexer(classCode: string, entityName: string): string | null {
  const imports = parseImportsWithLexer(classCode);
  
  // Создаем различные варианты имени entity для поиска
  const entitySnakeCase = toSnakeCase(entityName);
  const entityLowerCase = entityName.toLowerCase();
  const entityWithoutSuffix = entityName.replace(/Entity$/, '').toLowerCase();
  const entitySnakeCaseWithoutSuffix = toSnakeCase(entityName.replace(/Entity$/, ''));
  
  // Ищем среди импортов те, которые содержат entity
  for (const importInfo of imports) {
    if (importInfo.containsEntity) {
      const path = importInfo.path;
      
      // Проверяем различные варианты совпадений:
      // 1. Полное имя entity в snake_case (auth_login_entity)
      // 2. Полное имя entity в lowercase (authloginentity) 
      // 3. Имя без суффикса Entity в snake_case (auth_login)
      // 4. Имя без суффикса Entity в lowercase (authlogin)
      if (path.includes(entitySnakeCase) || 
          path.includes(entityLowerCase) ||
          path.includes(entityWithoutSuffix) ||
          path.includes(entitySnakeCaseWithoutSuffix)) {
        return path;
      }
    }
  }
  
  return null;
}

/**
 * Парсит имя entity класса из метода toEntity
 * @param classCode - код класса DTO
 * @param dtoName - имя DTO класса
 * @returns имя entity класса
 */
function parseEntityName(classCode: string, dtoName: string): string {
  const toEntityRegex = /toEntity\s*\(\s*\)\s*=>\s*(\w+)\s*\(/;
  const match = classCode.match(toEntityRegex);
  return match ? match[1] : `${dtoName.replace(/Dto$/, '')}Entity`; // Если не найдено, предполагаем имя
}

/**
 * Генерирует тестовый файл для DTO класса
 * @param workspaceRoot - корневая директория рабочего пространства
 * @param testDir - директория для тестов
 * @param featureName - имя фичи
 * @param dtoName - имя DTO класса
 * @param classCode - код DTO класса
 * @param packageName - имя пакета проекта
 */
export async function generateTest(workspaceRoot: vscode.Uri, testDir: string, featureName: string, dtoName: string, classCode: string, packageName: string) {
  const testFileName = `${dtoName.toLowerCase()}_test.dart`;
  const testUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, 'dto', testFileName);
  const dirUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, 'dto');
  await vscode.workspace.fs.createDirectory(dirUri);

  // Получаем активный документ
  const document = vscode.window.activeTextEditor?.document;
  if (!document) {
    vscode.window.showErrorMessage('Не удалось определить путь исходного файла.');
    return;
  }
  
  // Получаем полное содержимое файла
  const fullFileContent = document.getText();
  
  const filePath = document.uri.fsPath;
  const relativePath = path.relative(path.join(workspaceRoot.fsPath, 'lib'), filePath);
  const packagePath = `package:${packageName}/${relativePath.split(path.sep).join('/')}`;

  // Парсим fromJson для получения полей (используем classCode для парсинга класса)
  const dataItems = parseFromJson(classCode, dtoName);
  if (dataItems.length === 0) {
    vscode.window.showErrorMessage('Не удалось распарсить метод fromJson в DTO.');
    return;
  }

  // Парсим имя entity из toEntity (используем classCode для парсинга класса)
  const entityName = parseEntityName(classCode, dtoName);
  
  // Ищем импорт entity в коде файла
  const entityImportPath = findEntityImportWithLexer(fullFileContent, entityName);
  if (!entityImportPath) {
    vscode.window.showErrorMessage(`Не удалось найти импорт для entity класса ${entityName} в коде DTO.`);
    return;
  }

  // Генерируем константу _<dto_name>Data
  const simpleDataLines = dataItems.map(item => `  '${item.jsonKey}': null, // Переменная типа ${item.type}`).join('\n');
  const simpleData = `const _${dtoName.toLowerCase()}Data = {\n${simpleDataLines}\n};`;

  // Генерируем _expected
  const expectedFields = dataItems.map(item => `  ${item.dartName}: null, // Переменная типа ${item.type}`).join('\n');
  const expected = `final _expected = ${entityName}(\n${expectedFields}\n);`;

  // Генерируем тесты
  let tests = '';

  // Тест с правильными данными
  tests += `
    test('Проверка парсинга ${dtoName} с правильными данными', () {
      final result = ${dtoName}.fromJson(_${dtoName.toLowerCase()}Data).toEntity();
      expect(result, _expected);
    });`;

  // Тест с лишним полем
  tests += `
    test('Проверка парсинга ${dtoName}, если пришло лишнее поле', () {
      final data = Map<String, dynamic>.from(_${dtoName.toLowerCase()}Data)..['test'] = 'test';
      final result = ${dtoName}.fromJson(data).toEntity();
      expect(result, _expected);
    });`;

  // Тесты для каждого поля
  for (const item of dataItems) {
    const jsonKey = item.jsonKey;
    const type = item.type;

    // Тест, если поле не пришло
    tests += `
    test('Проверка парсинга ${dtoName}, если поле ${jsonKey} не пришло', () {
      final data = Map<String, dynamic>.from(_${dtoName.toLowerCase()}Data)..remove('${jsonKey}');
      expect(() => ${dtoName}.fromJson(data).toEntity(), throwsA(isA<TypeError>()));
    });`;

    // Тест, если поле неправильного типа
    const wrongValue = (type === 'int' || type === 'double') ? "'0'" : '0';
    tests += `
    test('Проверка парсинга ${dtoName}, если поле ${jsonKey} неправильного типа', () {
      final data = Map<String, dynamic>.from(_${dtoName.toLowerCase()}Data)..update('${jsonKey}', (_) => ${wrongValue});
      expect(() => ${dtoName}.fromJson(data).toEntity(), throwsA(isA<TypeError>()));
    });`;
  }

  // Формируем содержимое тестового файла с импортом entity
  const testContent = `
import 'package:flutter_test/flutter_test.dart';
import '${packagePath}';
import '${entityImportPath}';

${simpleData}

${expected}

void main() {
  group('Сценарий парсинга ${dtoName}', () {
    ${tests}
  });
}
`.trim();

  const content = new TextEncoder().encode(testContent);
  await vscode.workspace.fs.writeFile(testUri, content);
  vscode.window.showInformationMessage(`Тестовый файл создан: ${testUri.fsPath}`);
}