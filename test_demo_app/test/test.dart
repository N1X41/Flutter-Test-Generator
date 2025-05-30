import 'features/auth_login/auth_login_test.dart' as auth_login_test;
import 'features/notification_toggle/notification_toggle_test.dart' as notification_toggle_test;
import 'features/theme_settings/theme_settings_test.dart' as theme_settings_test;
import 'features/search_filter/search_filter_test.dart' as search_filter_test;

Future<void> main() async {
  auth_login_test.main();
  search_filter_test.main();
  theme_settings_test.main();
  notification_toggle_test.main();
}
