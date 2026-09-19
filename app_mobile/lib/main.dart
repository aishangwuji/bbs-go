import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme/app_theme.dart';
import 'providers/auth_provider.dart';
import 'providers/topic_provider.dart';
import 'views/home/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => TopicProvider()),
      ],
      child: const BbsGoApp(),
    ),
  );
}

/// bbs-go 移动客户端根组件
class BbsGoApp extends StatelessWidget {
  const BbsGoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'bbs-go 社区',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const HomeScreen(),
    );
  }
}
