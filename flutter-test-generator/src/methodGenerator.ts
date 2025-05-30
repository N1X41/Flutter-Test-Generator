import * as vscode from 'vscode';
import * as path from 'path';
import { TextEncoder } from 'util';

// Функция для преобразования camelCase или PascalCase в lower_case_with_underscores
function toLowerCaseWithUnderscores(name: string): string {
    return name
        .replace(/([a-z])([A-Z])/g, '$1_$2') // Разделяем camelCase или PascalCase
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2') // Обрабатываем последовательные заглавные буквы
        .toLowerCase() // Преобразуем в нижний регистр
        .replace(/\s+/g, '_'); // Заменяем пробелы на подчеркивания
}

export async function generateTest(workspaceRoot: vscode.Uri, testDir: string, methodName: string, methodCode: string, packageName: string) {
    // Преобразуем имя метода в lower_case_with_underscores
    const testFileName = `${toLowerCaseWithUnderscores(methodName)}_test.dart`;
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