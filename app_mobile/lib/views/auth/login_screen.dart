import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';

/// 登录与注册页面
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // 登录表单
  final TextEditingController _loginUsernameController = TextEditingController();
  final TextEditingController _loginPasswordController = TextEditingController();
  bool _loginObscure = true;

  // 注册表单
  final TextEditingController _regUsernameController = TextEditingController();
  final TextEditingController _regEmailController = TextEditingController();
  final TextEditingController _regNicknameController = TextEditingController();
  final TextEditingController _regPasswordController = TextEditingController();
  final TextEditingController _regRePasswordController = TextEditingController();
  bool _regObscure = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginUsernameController.dispose();
    _loginPasswordController.dispose();
    _regUsernameController.dispose();
    _regEmailController.dispose();
    _regNicknameController.dispose();
    _regPasswordController.dispose();
    _regRePasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSignin() async {
    final username = _loginUsernameController.text.trim();
    final password = _loginPasswordController.text;

    if (username.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入用户名和密码')),
      );
      return;
    }

    final success = await context.read<AuthProvider>().signin(
          username: username,
          password: password,
        );

    if (success && mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _handleSignup() async {
    final username = _regUsernameController.text.trim();
    final email = _regEmailController.text.trim();
    final nickname = _regNicknameController.text.trim();
    final password = _regPasswordController.text;
    final rePassword = _regRePasswordController.text;

    if (username.isEmpty || email.isEmpty || nickname.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请将注册信息填写完整')),
      );
      return;
    }

    if (password != rePassword) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('两次输入的密码不一致')),
      );
      return;
    }

    final success = await context.read<AuthProvider>().signup(
          username: username,
          email: email,
          nickname: nickname,
          password: password,
          rePassword: rePassword,
        );

    if (success && mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('账号认证'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppTheme.primaryColor,
          unselectedLabelColor: AppTheme.textSecondary,
          indicatorColor: AppTheme.primaryColor,
          tabs: const [
            Tab(text: '登录账号'),
            Tab(text: '注册新账号'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: 登录
          _buildSigninTab(authProvider),
          // Tab 2: 注册
          _buildSignupTab(authProvider),
        ],
      ),
    );
  }

  Widget _buildSigninTab(AuthProvider authProvider) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      children: [
        const Text(
          '欢迎回到 bbs-go 社区',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          '登录以发表观点、点赞互动及参与讨论',
          style: TextStyle(fontSize: 14, color: AppTheme.textSecondary),
        ),
        const SizedBox(height: 32),

        // 用户名/邮箱
        TextField(
          controller: _loginUsernameController,
          decoration: const InputDecoration(
            labelText: '用户名 / 邮箱',
            prefixIcon: Icon(Icons.person_outline),
          ),
        ),
        const SizedBox(height: 16),

        // 密码
        TextField(
          controller: _loginPasswordController,
          obscureText: _loginObscure,
          decoration: InputDecoration(
            labelText: '登录密码',
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(_loginObscure ? Icons.visibility_off : Icons.visibility),
              onPressed: () => setState(() => _loginObscure = !_loginObscure),
            ),
          ),
        ),
        const SizedBox(height: 28),

        // 登录按钮
        ElevatedButton(
          onPressed: authProvider.isLoading ? null : _handleSignin,
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: authProvider.isLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('立即登录', style: TextStyle(fontSize: 16)),
        ),
      ],
    );
  }

  Widget _buildSignupTab(AuthProvider authProvider) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      children: [
        const Text(
          '加入 bbs-go 社区',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: AppTheme.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          '创建您的专属账号，畅享社区优质资源',
          style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
        ),
        const SizedBox(height: 24),

        // 用户名
        TextField(
          controller: _regUsernameController,
          decoration: const InputDecoration(
            labelText: '用户名（英文/数字）',
            prefixIcon: Icon(Icons.account_circle_outlined),
          ),
        ),
        const SizedBox(height: 14),

        // 昵称
        TextField(
          controller: _regNicknameController,
          decoration: const InputDecoration(
            labelText: '用户昵称',
            prefixIcon: Icon(Icons.badge_outlined),
          ),
        ),
        const SizedBox(height: 14),

        // 邮箱
        TextField(
          controller: _regEmailController,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            labelText: '电子邮箱',
            prefixIcon: Icon(Icons.email_outlined),
          ),
        ),
        const SizedBox(height: 14),

        // 密码
        TextField(
          controller: _regPasswordController,
          obscureText: _regObscure,
          decoration: InputDecoration(
            labelText: '设置密码',
            prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              icon: Icon(_regObscure ? Icons.visibility_off : Icons.visibility),
              onPressed: () => setState(() => _regObscure = !_regObscure),
            ),
          ),
        ),
        const SizedBox(height: 14),

        // 确认密码
        TextField(
          controller: _regRePasswordController,
          obscureText: _regObscure,
          decoration: const InputDecoration(
            labelText: '确认密码',
            prefixIcon: Icon(Icons.lock_reset_outlined),
          ),
        ),
        const SizedBox(height: 24),

        // 注册按钮
        ElevatedButton(
          onPressed: authProvider.isLoading ? null : _handleSignup,
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: authProvider.isLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text('完成注册并登录', style: TextStyle(fontSize: 16)),
        ),
      ],
    );
  }
}
