import 'package:flutter/foundation.dart';
import 'package:fluttertoast/fluttertoast.dart';
import '../core/constants/api_constants.dart';
import '../core/network/api_client.dart';
import '../core/storage/sp_storage.dart';
import '../models/user_model.dart';

/// 认证与当前登录用户状态管理
class AuthProvider extends ChangeNotifier {
  UserModel? _currentUser;
  String? _token;
  bool _isLoading = false;

  UserModel? get currentUser => _currentUser;
  String? get token => _token;
  bool get isLoggedIn => _token != null && _token!.isNotEmpty && _currentUser != null;
  bool get isLoading => _isLoading;

  /// 初始化：从本地持久化加载登录凭据
  Future<void> init() async {
    final storage = await SpStorage.getInstance();
    _token = storage.getToken();
    final cachedUser = storage.getUserInfo();
    if (cachedUser != null) {
      _currentUser = UserModel.fromJson(cachedUser);
      notifyListeners();
    }

    // 若本地存在 Token，向服务端同步最新的个人信息
    if (_token != null && _token!.isNotEmpty) {
      await loadCurrentUser();
    }
  }

  /// 账号密码登录
  Future<bool> signin({
    required String username,
    required String password,
    String? captchaId,
    String? captchaCode,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await ApiClient.instance.post(
        ApiConstants.loginSignin,
        data: {
          'username': username,
          'password': password,
          if (captchaId != null) 'captchaId': captchaId,
          if (captchaCode != null) 'captchaCode': captchaCode,
        },
      );

      _isLoading = false;

      if (response.isSuccess && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final token = data['token']?.toString();
        final userMap = data['user'] as Map<String, dynamic>?;

        if (token != null && userMap != null) {
          _token = token;
          _currentUser = UserModel.fromJson(userMap);

          final storage = await SpStorage.getInstance();
          await storage.setToken(token);
          await storage.setUserInfo(userMap);

          Fluttertoast.showToast(msg: '登录成功');
          notifyListeners();
          return true;
        }
      }
      notifyListeners();
      return false;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      Fluttertoast.showToast(msg: '登录失败: $e');
      return false;
    }
  }

  /// 账号注册
  Future<bool> signup({
    required String username,
    required String email,
    required String nickname,
    required String password,
    required String rePassword,
    String? captchaId,
    String? captchaCode,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await ApiClient.instance.post(
        ApiConstants.loginSignup,
        data: {
          'username': username,
          'email': email,
          'nickname': nickname,
          'password': password,
          'rePassword': rePassword,
          if (captchaId != null) 'captchaId': captchaId,
          if (captchaCode != null) 'captchaCode': captchaCode,
        },
      );

      _isLoading = false;

      if (response.isSuccess && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final token = data['token']?.toString();
        final userMap = data['user'] as Map<String, dynamic>?;

        if (token != null && userMap != null) {
          _token = token;
          _currentUser = UserModel.fromJson(userMap);

          final storage = await SpStorage.getInstance();
          await storage.setToken(token);
          await storage.setUserInfo(userMap);

          Fluttertoast.showToast(msg: '注册成功并已登录');
          notifyListeners();
          return true;
        }
      }
      notifyListeners();
      return false;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      Fluttertoast.showToast(msg: '注册失败: $e');
      return false;
    }
  }

  /// 从服务端加载最新的当前用户信息
  Future<void> loadCurrentUser() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConstants.userCurrent,
      );
      if (response.isSuccess && response.data is Map<String, dynamic>) {
        final userMap = response.data as Map<String, dynamic>;
        _currentUser = UserModel.fromJson(userMap);
        final storage = await SpStorage.getInstance();
        await storage.setUserInfo(userMap);
        notifyListeners();
      } else if (response.code == 401 || response.code == 1000) {
        // Token 已过期或失效
        await signout();
      }
    } catch (_) {}
  }

  /// 每日签到
  Future<bool> checkin() async {
    if (!isLoggedIn) {
      Fluttertoast.showToast(msg: '请先登录');
      return false;
    }
    try {
      final response = await ApiClient.instance.post(ApiConstants.checkinSubmit);
      if (response.isSuccess) {
        Fluttertoast.showToast(msg: '签到成功！积分已到账');
        await loadCurrentUser();
        return true;
      }
      return false;
    } catch (e) {
      Fluttertoast.showToast(msg: '签到失败: $e');
      return false;
    }
  }

  /// 退出登录
  Future<void> signout() async {
    try {
      await ApiClient.instance.get(ApiConstants.loginSignout);
    } catch (_) {}

    _token = null;
    _currentUser = null;
    final storage = await SpStorage.getInstance();
    await storage.clearAuth();
    Fluttertoast.showToast(msg: '已退出登录');
    notifyListeners();
  }
}
