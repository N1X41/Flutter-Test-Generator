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
// Парсинг состояний
function parseStates(stateFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const stateDocument = yield vscode.workspace.openTextDocument(stateFilePath);
        const stateCode = stateDocument.getText();
        const stateRegex = /final class (\w+) extends \w+State/g;
        const states = [];
        let match;
        while ((match = stateRegex.exec(stateCode)) !== null) {
            states.push({ name: match[1] });
        }
        return states;
    });
}
// Парсинг методов, событий и зависимостей
function parseCubitOrBloc(classCode) {
    const events = [];
    const dependencies = [];
    const methods = [];
    const onRegex = /on<(\w+)>\((\w+)\)/g;
    const dependencyRegex = /final (\w+) _(\w+);/g;
    const methodRegex = /(\w+)\((.*?)\)\s*{([\s\S]*?)}/g;
    let match;
    while ((match = onRegex.exec(classCode)) !== null) {
        events.push({ name: match[1], handler: match[2] });
    }
    while ((match = dependencyRegex.exec(classCode)) !== null) {
        if (match[1].includes('Repository') || match[1].includes('Secure')) {
            dependencies.push({ name: match[2], type: match[1] });
        }
    }
    while ((match = methodRegex.exec(classCode)) !== null) {
        const methodName = match[1];
        const params = match[2].split(',').map(p => p.trim()).filter(p => p);
        const body = match[3];
        const transitions = [];
        const emitRegex = /emit\(const (\w+)\(\)\);/g;
        const guardRegex = /if \(state is (\w+)\)\s*return;/g;
        let emitMatch;
        while ((emitMatch = emitRegex.exec(body)) !== null) {
            transitions.push({ from: '', to: emitMatch[1] });
        }
        let guardMatch;
        while ((guardMatch = guardRegex.exec(body)) !== null) {
            transitions.forEach(t => t.condition = `state is not ${guardMatch[1]}`);
        }
        methods.push({ name: methodName, parameters: params, transitions });
    }
    return { events, dependencies, methods };
}
// Генерация тестов
function generateTest(workspaceRoot, testDir, featureName, cubitName, classCode, packageName) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const isBloc = cubitName.toLowerCase().includes('bloc');
        const testFileName = `${cubitName.toLowerCase()}_test.dart`;
        const testUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, isBloc ? 'bloc' : 'cubit', testFileName);
        const dirUri = vscode.Uri.joinPath(workspaceRoot, testDir, 'features', featureName, isBloc ? 'bloc' : 'cubit');
        yield vscode.workspace.fs.createDirectory(dirUri);
        // Формирование пути к файлу состояний путем замены _cubit или _bloc на _state
        const cubitFilePath = ((_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.uri.fsPath) || '';
        const cubitFileName = path.basename(cubitFilePath, '.dart');
        const stateFileName = cubitFileName.replace(/_cubit|_bloc$/, '_state') + '.dart';
        const stateFilePath = path.join(path.dirname(cubitFilePath), stateFileName);
        const states = yield parseStates(stateFilePath);
        const { events, dependencies, methods } = parseCubitOrBloc(classCode);
        const mockDeclarations = dependencies.map(dep => `class _Fake${dep.type} extends Mock implements ${dep.type} {}`).join('\n');
        const lateDeclarations = dependencies.map(dep => `late _Fake${dep.type} fake${dep.type};`).join('\n') + `\nlate ${cubitName} ${cubitName.toLowerCase()};`;
        const setUpContent = dependencies.map(dep => `fake${dep.type} = _Fake${dep.type}();`).join('\n') + `\n${cubitName.toLowerCase()} = ${cubitName}(${dependencies.map(dep => `${dep.name}: fake${dep.type}`).join(', ')});`;
        const tearDownContent = `${cubitName.toLowerCase()}.close();`;
        let tests = '';
        if (isBloc) {
            for (const event of events) {
                const method = methods.find(m => m.name === event.handler);
                if (method) {
                    for (const state of states) {
                        for (const transition of method.transitions) {
                            tests += `
    blocTest<${cubitName}, ${cubitName.replace('Cubit', '').replace('Bloc', '')}State>(
      'Проверка достижения состояния ${transition.to} из ${state.name}',
      build: () => ${cubitName.toLowerCase()},
      act: (bloc) => bloc.add(${event.name}()),
      expect: () => [${transition.to}()],
    );`;
                        }
                    }
                }
            }
        }
        else {
            for (const method of methods) {
                for (const state of states) {
                    for (const transition of method.transitions) {
                        tests += `
    test('Проверка достижения состояния ${transition.to} из ${state.name}', () {
      expect(${cubitName.toLowerCase()}.state, equals(const ${state.name}()));
      ${cubitName.toLowerCase()}.${method.name}();
      expect(${cubitName.toLowerCase()}.state, equals(const ${transition.to}()));
    });`;
                    }
                }
            }
        }
        const testContent = `
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:${packageName}/features/${featureName}/${isBloc ? 'bloc' : 'cubit'}/${cubitName.toLowerCase()}.dart';

${mockDeclarations}

void main() {
  ${lateDeclarations}

  setUp(() {
    ${setUpContent}
  });

  tearDown(() {
    ${tearDownContent}
  });

  group('Сценарий проверки бизнес логики фичи ${featureName}', () {
    ${tests}
  });
}
`.trim();
        const content = new util_1.TextEncoder().encode(testContent);
        yield vscode.workspace.fs.writeFile(testUri, content);
        vscode.window.showInformationMessage(`Тестовый файл создан: ${testUri.fsPath}`);
    });
}
exports.generateTest = generateTest;
//# sourceMappingURL=cubitGenerator.js.map