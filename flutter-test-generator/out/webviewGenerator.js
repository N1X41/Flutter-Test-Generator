"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestAnalysisWebview = void 0;
const vscode = require("vscode");
const cubitGeneratorNew_1 = require("./cubitGeneratorNew");
/**
 * Создает webview панель с анализом тестов
 * @param cubitName - имя кубита/блока
 * @param enhancedMethods - анализированные методы
 * @param enhancedStates - анализированные состояния
 * @param fsm - автомат состояний
 * @param testPaths - тестовые пути
 * @param executionBranches - ветки выполнения
 * @param fsmDot - DOT код для FSM графа
 * @param pathsDot - DOT код для графа путей
 */
function createTestAnalysisWebview(cubitName, enhancedMethods, enhancedStates, fsm, testPaths, executionBranches, fsmDot, pathsDot) {
    // Статистика
    const totalStates = enhancedStates.length;
    const reachableStates = enhancedStates.filter(s => s.isReachable).length;
    const totalMethods = enhancedMethods.length;
    const totalTransitions = fsm.transitions.length;
    const totalTestPaths = testPaths.length;
    // Генерируем информацию о методах
    const methodsInfo = enhancedMethods.map((method, index) => `
        <div class="method-info">
            <h5>🔧 ${method.name}${method.type === 'event' ? ' (Event)' : ' (Method)'}</h5>
            <div class="method-details">
                ${method.event ? `<div><strong>Событие:</strong> ${method.event}</div>` : ''}
                ${method.handler ? `<div><strong>Обработчик:</strong> ${method.handler}</div>` : ''}
                <div class="allowed-states"><strong>Разрешенные состояния:</strong> ${method.allowedStates.join(', ') || 'любые'}</div>
                <div class="reachable-states"><strong>Достижимые состояния:</strong> ${method.reachableStates.join(', ') || 'нет'}</div>
                <div class="final-states"><strong>Финальные состояния:</strong> ${method.finalStates.join(', ') || 'нет'}</div>
                <div class="transient-states"><strong>Сквозные состояния:</strong> ${method.transientStates.join(', ') || 'нет'}</div>
                <div class="guard-conditions"><strong>Guard условия:</strong> ${method.guardConditions.map(g => `${g.blockedState}: ${g.action}`).join(', ') || 'нет'}</div>
                <div class="transitions-count"><strong>Количество переходов:</strong> ${method.transitions.length}</div>
                <div class="calls-info"><strong>Repository вызовы:</strong> ${method.repositoryCalls.join(', ') || 'нет'}</div>
                <div class="calls-info"><strong>Storage вызовы:</strong> ${method.storageCalls.join(', ') || 'нет'}</div>
                <div class="calls-info"><strong>Приватные методы:</strong> ${method.privateMethodCalls.join(', ') || 'нет'}</div>
                ${method.isArrowFunction ? '<div><strong>Тип:</strong> Стрелочная функция</div>' : ''}
            </div>
        </div>
    `).join('');
    // Генерируем информацию о ветках выполнения
    const branchesInfo = Array.from(executionBranches.entries()).map(([methodName, branches]) => `
        <div class="event-branches">
            <h5>🌿 Ветки выполнения для ${methodName}</h5>
            ${branches.map((branch, index) => `
                <div class="branch-info">
                    <h6>Ветка ${index + 1}: ${branch.branchId}</h6>
                    <div class="branch-details">
                        <div><strong>Состояния:</strong> ${branch.states.join(' → ')}</div>
                        <div><strong>Repository вызовы:</strong> ${branch.repositoryCalls.join(', ') || 'нет'}</div>
                        <div><strong>Storage вызовы:</strong> ${branch.storageCalls.join(', ') || 'нет'}</div>
                        <div><strong>Приватные методы:</strong> ${branch.privateMethodCalls.join(', ') || 'нет'}</div>
                        <div><strong>Успешный путь:</strong> ${branch.isSuccessPath ? '✅' : '❌'}</div>
                        <div><strong>Путь ошибки:</strong> ${branch.isErrorPath ? '⚠️' : '✅'}</div>
                        <div><strong>Финальное состояние:</strong> ${branch.isFinalState ? '🏁' : '🔄'}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
    // Генерируем информацию о комбинированных путях
    const combinedPaths = testPaths.filter(path => path.methods.length > 1);
    const combinedPathsInfo = combinedPaths.map((path, index) => `
        <div class="combined-path-info">
            <h5>🔗 Комбинированный путь ${index + 1}</h5>
            <div class="path-details">
                <div><strong>Последовательность состояний:</strong> ${path.states.join(' → ')}</div>
                <div><strong>Последовательность методов:</strong> ${path.methods.join(' → ')}</div>
                <div><strong>Длина пути:</strong> ${path.methods.length} переходов</div>
                ${(() => {
        const combinedData = (0, cubitGeneratorNew_1.createCombinedTestData)(path, enhancedMethods);
        return `
                    <div><strong>Объединенные Repository вызовы:</strong> ${combinedData.combinedRepositoryCalls.join(', ') || 'нет'}</div>
                    <div><strong>Объединенные Storage вызовы:</strong> ${combinedData.combinedStorageCalls.join(', ') || 'нет'}</div>
                    <div><strong>Состояния конкретных переходов:</strong> ${combinedData.allStatesInOrder.join(', ') || 'нет'}</div>
                    <div><strong>Все достижимые состояния:</strong> ${combinedData.allReachableStates.join(', ') || 'нет'}</div>
                    `;
    })()}
            </div>
        </div>
    `).join('');
    // Генерируем HTML контент
    const htmlContent = generateHTMLContent(cubitName, totalStates, reachableStates, totalMethods, totalTransitions, totalTestPaths, methodsInfo, branchesInfo, combinedPathsInfo, fsmDot, pathsDot);
    // Создаем webview панель
    const panel = vscode.window.createWebviewPanel('testAnalysisV2', `🎯 Анализ тестов v2.0: ${cubitName}`, vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true
    });
    panel.webview.html = htmlContent;
    console.log('✓ WebView панель открыта в VS Code');
}
exports.createTestAnalysisWebview = createTestAnalysisWebview;
/**
 * Генерирует HTML контент для webview
 */
function generateHTMLContent(cubitName, totalStates, reachableStates, totalMethods, totalTransitions, totalTestPaths, methodsInfo, branchesInfo, combinedPathsInfo, fsmDot, pathsDot) {
    return `<!DOCTYPE html>
 <html>
 <head>
     <title>Анализ генератора тестов v2.0: ${cubitName}</title>
     <meta charset="UTF-8">
     <script src="https://unpkg.com/@hpcc-js/wasm@1.12.8/dist/index.min.js"></script>
     <script src="https://unpkg.com/d3@5"></script>
     <script src="https://unpkg.com/d3-graphviz@3.1.0/build/d3-graphviz.min.js"></script>
     <style>
         ${getWebviewCSS()}
     </style>
 </head>
 <body>
     <div class="container">
         <div class="header">
             <h1>🎯 Анализ генератора тестов</h1>
         </div>

         <div class="stats">
             <h3>📊 Статистика анализа</h3>
             <ul>
                 <li><strong>Общее количество состояний:</strong> ${totalStates}</li>
                 <li><strong>Достижимых состояний:</strong> ${reachableStates}</li>
                 <li><strong>Проанализированных методов/событий:</strong> ${totalMethods}</li>
                 <li><strong>Общее количество переходов в автомате:</strong> ${totalTransitions}</li>
                 <li><strong>Сгенерированных тестовых путей:</strong> ${totalTestPaths}</li>
                 <li><strong>Комбинированных путей:</strong> ${combinedPathsInfo ? combinedPathsInfo.split('combined-path-info').length - 1 : 0}</li>
             </ul>
         </div>

         <div class="buttons-section">
             <h3>🎮 Интерактивные графы</h3>
             <button class="btn btn-primary" onclick="showFSMGraph()">📈 Показать граф автомата состояний</button>
             <button class="btn btn-success" onclick="showPathsGraph()">🛤️ Показать граф тестовых путей</button>
             <button class="btn btn-warning" onclick="copyFSMDot()">📋 Копировать DOT автомата</button>
             <button class="btn btn-info" onclick="copyPathsDot()">📋 Копировать DOT путей</button>
             <button class="btn btn-secondary" onclick="openGraphvizOnline()">🌐 Graphviz Online</button>
         </div>

         <div id="fsm-graph" style="display: none;"></div>
         <div id="paths-graph" style="display: none;"></div>

         <div class="collapsible-section">
             <div class="collapsible-header" onclick="toggleCollapsible('methods-section')">
                 <h3>⚙️ Детальный анализ методов/событий</h3>
                 <span class="collapsible-arrow" id="methods-section-arrow">▼</span>
             </div>
             <div class="collapsible-content methods-section" id="methods-section">
                 ${methodsInfo}
             </div>
         </div>

         ${branchesInfo ? `
         <div class="collapsible-section">
             <div class="collapsible-header" onclick="toggleCollapsible('branches-section')">
                 <h3>🌿 Ветки выполнения</h3>
                 <span class="collapsible-arrow" id="branches-section-arrow">▼</span>
             </div>
             <div class="collapsible-content methods-section" id="branches-section">
                 ${branchesInfo}
             </div>
         </div>
         ` : ''}

         ${combinedPathsInfo ? `
         <div class="methods-section">
             <h3>🔗 Комбинированные тестовые пути</h3>
             ${combinedPathsInfo}
         </div>
         ` : ''}

         <div class="tech-info">
             <h4>🔧 Техническая информация</h4>
             <ul>
                 <li><strong>Алгоритм:</strong> Enhanced FSM + BFS для тестовых путей</li>
                 <li><strong>Анализ контекста:</strong> Глубокий анализ emit statements</li>
                 <li><strong>Guard условия:</strong> Автоматическое обнаружение</li>
                 <li><strong>Ветки выполнения:</strong> Анализ try-catch и условных блоков</li>
                 <li><strong>Mock объекты:</strong> Автоматическое создание на основе зависимостей</li>
             </ul>
         </div>
     </div>

     <script>
         ${getWebviewJavaScript(fsmDot, pathsDot)}
     </script>
 </body>
 </html>`;
}
/**
 * Возвращает CSS стили для webview
 */
function getWebviewCSS() {
    return `
         body { 
             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
             margin: 0; 
             padding: 20px;
             background-color: #f8f9fa;
             color: #212529;
             line-height: 1.6;
         }
         .container {
             max-width: 1400px;
             margin: 0 auto;
             background-color: white;
             padding: 30px;
             border-radius: 12px;
             box-shadow: 0 4px 12px rgba(0,0,0,0.1);
         }
         .header {
             color: #2c3e50;
             border-bottom: 3px solid #3498db;
             padding-bottom: 15px;
             margin-bottom: 30px;
             text-align: center;
         }
         .stats {
             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
             color: white;
             border-radius: 8px;
             padding: 20px;
             margin: 20px 0;
         }
         .stats h3 {
             margin-top: 0;
             color: white;
         }
         .stats ul {
             list-style-type: none;
             padding: 0;
         }
         .stats li {
             margin: 8px 0;
             padding: 5px 0;
             border-bottom: 1px solid rgba(255,255,255,0.2);
         }
         
         /* Стили для графов */
         #fsm-graph, #paths-graph {
             width: 100% !important;
             max-width: 100% !important;
             height: 600px !important;
             border: 1px solid #ccc;
             margin: 20px 0;
             overflow: auto !important;
             background-color: white;
             border-radius: 8px;
         }
         #fsm-graph svg, #paths-graph svg {
             max-width: 100% !important;
             height: auto !important;
             display: block;
             margin: 0 auto;
         }
         
         /* Стили для сворачивающихся секций */
         .collapsible-section {
             background-color: #f8f9fa;
             border: 1px solid #dee2e6;
             border-radius: 8px;
             margin: 20px 0;
         }
         .collapsible-header {
             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
             color: white;
             padding: 15px 20px;
             cursor: pointer;
             border-radius: 7px 7px 0 0;
             user-select: none;
             transition: all 0.3s ease;
             display: flex;
             justify-content: space-between;
             align-items: center;
         }
         .collapsible-header:hover {
             background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
         }
         .collapsible-header h3 {
             margin: 0;
             color: white;
         }
         .collapsible-arrow {
             transition: transform 0.3s ease;
             font-size: 18px;
             font-weight: bold;
         }
         .collapsible-content {
             padding: 20px;
             display: none;
             animation: slideDown 0.3s ease;
         }
         .collapsible-content.active {
             display: block;
         }
         @keyframes slideDown {
             from { opacity: 0; max-height: 0; }
             to { opacity: 1; max-height: 1000px; }
         }
         
         .methods-section {
             background-color: transparent;
             border: none;
             border-radius: 0;
             padding: 0;
             margin: 0;
         }
         .method-info {
             background-color: white;
             border-left: 4px solid #007bff;
             border-radius: 4px;
             padding: 15px;
             margin: 15px 0;
             box-shadow: 0 2px 4px rgba(0,0,0,0.05);
         }
         .method-details {
             margin-top: 10px;
             font-size: 0.9em;
         }
         .method-details > div {
             margin: 8px 0;
             padding: 5px 0;
         }
         .allowed-states { color: #28a745; }
         .reachable-states { color: #007bff; }
         .final-states { color: #fd7e14; }
         .transient-states { color: #6f42c1; }
         .guard-conditions { color: #dc3545; }
         .transitions-count { color: #6610f2; }
         .calls-info { color: #6c757d; }
         .event-branches {
             background-color: white;
             border-left: 4px solid #28a745;
             border-radius: 4px;
             padding: 15px;
             margin: 15px 0;
             box-shadow: 0 2px 4px rgba(0,0,0,0.05);
         }
         .branch-info {
             background-color: #f8f9fa;
             border: 1px solid #e9ecef;
             border-radius: 4px;
             padding: 12px;
             margin: 10px 0;
         }
         .branch-details {
             margin-top: 8px;
             font-size: 0.9em;
         }
         .branch-details > div {
             margin: 4px 0;
         }
         .combined-path-info {
             background-color: white;
             border-left: 4px solid #ffc107;
             border-radius: 4px;
             padding: 15px;
             margin: 15px 0;
             box-shadow: 0 2px 4px rgba(0,0,0,0.05);
         }
         .path-details {
             margin-top: 8px;
             font-size: 0.9em;
         }
         .path-details > div {
             margin: 4px 0;
         }
         .enhanced-badge {
             background: linear-gradient(45deg, #28a745, #20c997);
             color: white;
             padding: 5px 15px;
             border-radius: 20px;
             font-size: 0.8em;
             margin-left: 15px;
             font-weight: bold;
         }
         .buttons-section {
             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
             color: white;
             border-radius: 8px;
             padding: 20px;
             margin: 20px 0;
             text-align: center;
         }
         .btn {
             display: inline-block;
             padding: 12px 24px;
             margin: 10px;
             background-color: #007bff;
             color: white;
             text-decoration: none;
             border-radius: 6px;
             border: none;
             cursor: pointer;
             font-size: 14px;
             transition: all 0.3s ease;
         }
         .btn:hover {
             background-color: #0056b3;
             transform: translateY(-2px);
             box-shadow: 0 4px 8px rgba(0,0,0,0.2);
         }
         .btn-primary { background-color: #007bff; }
         .btn-success { background-color: #28a745; }
         .btn-warning { background-color: #ffc107; color: #212529; }
         .btn-info { background-color: #17a2b8; }
         .btn-secondary { background-color: #6c757d; }
         .tech-info {
             background-color: #e9ecef;
             border-radius: 8px;
             padding: 20px;
             margin: 20px 0;
         }
         .tech-info h4 {
             color: #495057;
             border-bottom: 2px solid #adb5bd;
             padding-bottom: 8px;
         }
         .tech-info ul {
             list-style-type: none;
             padding: 0;
         }
         .tech-info li {
             margin: 6px 0;
             padding: 4px 0;
             border-bottom: 1px solid #ced4da;
         }
    `;
}
/**
 * Возвращает JavaScript код для webview
 */
function getWebviewJavaScript(fsmDot, pathsDot) {
    return `
         const fsmDotData = \`${fsmDot.replace(/`/g, '\\`')}\`;
         const pathsDotData = \`${pathsDot.replace(/`/g, '\\`')}\`;

         function showFSMGraph() {
             hidePathsGraph();
             const container = document.getElementById('fsm-graph');
             container.style.display = 'block';
             
             try {
                 d3.select("#fsm-graph").graphviz()
                     .renderDot(fsmDotData)
                     .on("end", function() {
                         console.log('FSM граф отрендерен');
                     });
             } catch (error) {
                 console.error('Ошибка рендеринга FSM графа:', error);
                 container.innerHTML = '<div style="padding: 20px; color: #dc3545;">❌ Ошибка рендеринга графа. Проверьте консоль браузера.</div>';
             }
         }

         function hideFSMGraph() {
             const container = document.getElementById('fsm-graph');
             container.style.display = 'none';
             container.innerHTML = '';
         }

         function showPathsGraph() {
             hideFSMGraph();
             const container = document.getElementById('paths-graph');
             container.style.display = 'block';
             
             try {
                 d3.select("#paths-graph").graphviz()
                     .renderDot(pathsDotData)
                     .on("end", function() {
                         console.log('Paths граф отрендерен');
                     });
             } catch (error) {
                 console.error('Ошибка рендеринга Paths графа:', error);
                 container.innerHTML = '<div style="padding: 20px; color: #dc3545;">❌ Ошибка рендеринга графа. Проверьте консоль браузера.</div>';
             }
         }

         function hidePathsGraph() {
             const container = document.getElementById('paths-graph');
             container.style.display = 'none';
             container.innerHTML = '';
         }

         function copyFSMDot() {
             navigator.clipboard.writeText(fsmDotData).then(() => {
                 alert('📋 DOT код автомата состояний скопирован в буфер обмена!');
             }).catch(err => {
                 console.error('Ошибка копирования: ', err);
                 alert('❌ Ошибка копирования в буфер обмена');
             });
         }

         function copyPathsDot() {
             navigator.clipboard.writeText(pathsDotData).then(() => {
                 alert('📋 DOT код тестовых путей скопирован в буфер обмена!');
             }).catch(err => {
                 console.error('Ошибка копирования: ', err);
                 alert('❌ Ошибка копирования в буфер обмена');
             });
         }

         function openGraphvizOnline() {
             window.open('https://dreampuf.github.io/GraphvizOnline/', '_blank');
             alert('🌐 Graphviz Online открыт в новой вкладке. Вставьте скопированный DOT код для визуализации!');
         }
         
         function toggleCollapsible(sectionId) {
             const content = document.getElementById(sectionId);
             const arrow = document.getElementById(sectionId + '-arrow');
             
             if (content.classList.contains('active')) {
                 content.classList.remove('active');
                 arrow.style.transform = 'rotate(0deg)';
                 arrow.textContent = '▼';
             } else {
                 content.classList.add('active');
                 arrow.style.transform = 'rotate(180deg)';
                 arrow.textContent = '▲';
             }
         }
    `;
}
//# sourceMappingURL=webviewGenerator.js.map