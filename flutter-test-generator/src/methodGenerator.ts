import * as vscode from 'vscode';
import * as path from 'path';
import { TextEncoder } from 'util';
import { toSnakeCase } from './utils';

/**
 * Генерирует тестовый файл для отдельного метода или функции
 * @param workspaceRoot - корневая директория рабочего пространства
 * @param testDir - директория для тестов
 * @param methodName - имя метода для тестирования
 * @param methodCode - код метода
 * @param packageName - имя пакета проекта
 */
export async function generateTest(workspaceRoot: vscode.Uri, testDir: string, methodName: string, methodCode: string, packageName: string) {
    const testFileName = `${toSnakeCase(methodName)}_test.dart`;
    const testUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'unit_test', testFileName);
    const dirUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'unit_test');
    await vscode.workspace.fs.createDirectory(dirUri);

    // Получаем путь исходного файла относительно lib/
    const document = vscode.window.activeTextEditor?.document;
    if (!document) {
        vscode.window.showErrorMessage('Не удалось определить путь исходного файла.');
        return;
    }
    const filePath = document.uri.fsPath;
    const relativePath = path.relative(path.join(workspaceRoot.fsPath, 'lib'), filePath);
    const packagePath = `package:${packageName}/${relativePath.split(path.sep).join('/')}`;

    // Формируем содержимое тестового файла
    const testContent = `
import 'package:flutter_test/flutter_test.dart';
import '${packagePath}';

void main() {
  group('Тестирование метода ${methodName}', () {
    test('Тест для копирования', () {
      final result = ${methodName}();
      const expected = null; // Заполните ожидаемое значение
      expect(result, expected);
    });
  });
}
`.trim();

    const content = new TextEncoder().encode(testContent);
    await vscode.workspace.fs.writeFile(testUri, content);
    vscode.window.showInformationMessage(`Тестовый файл создан: ${testUri.fsPath}`);
}