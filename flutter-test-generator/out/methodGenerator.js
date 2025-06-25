"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTest = void 0;
const vscode = require("vscode");
const path = require("path");
const util_1 = require("util");
const utils_1 = require("./utils");
/**
 * Генерирует тестовый файл для отдельного метода или функции
 * @param workspaceRoot - корневая директория рабочего пространства
 * @param testDir - директория для тестов
 * @param methodName - имя метода для тестирования
 * @param methodCode - код метода
 * @param packageName - имя пакета проекта
 */
function generateTest(workspaceRoot, testDir, methodName, methodCode, packageName) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const testFileName = `${(0, utils_1.toSnakeCase)(methodName)}_test.dart`;
        const testUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'unit_test', testFileName);
        const dirUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'unit_test');
        yield vscode.workspace.fs.createDirectory(dirUri);
        // Получаем путь исходного файла относительно lib/
        const document = (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document;
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
        const content = new util_1.TextEncoder().encode(testContent);
        yield vscode.workspace.fs.writeFile(testUri, content);
        vscode.window.showInformationMessage(`Тестовый файл создан: ${testUri.fsPath}`);
    });
}
exports.generateTest = generateTest;
//# sourceMappingURL=methodGenerator.js.map