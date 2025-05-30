# Создание структуры тестового проекта

# Фичи с блоками (5 штук)
$blocFeatures = @(
    "auth_login",
    "user_profile", 
    "news_feed",
    "chat_messaging",
    "payment_processing"
)

# Фичи с кубитами (5 штук)
$cubitFeatures = @(
    "theme_settings",
    "language_selector",
    "notification_toggle",
    "search_filter",
    "favorites_manager"
)

# Создание структуры для блоков
foreach ($feature in $blocFeatures) {
    New-Item -ItemType Directory -Path "lib\features\$feature\bloc" -Force
    New-Item -ItemType Directory -Path "lib\features\$feature\dto" -Force
    New-Item -ItemType Directory -Path "lib\features\$feature\methods" -Force
}

# Создание структуры для кубитов
foreach ($feature in $cubitFeatures) {
    New-Item -ItemType Directory -Path "lib\features\$feature\cubit" -Force
    New-Item -ItemType Directory -Path "lib\features\$feature\dto" -Force
    New-Item -ItemType Directory -Path "lib\features\$feature\methods" -Force
}

Write-Host "Структура проекта создана успешно!" 