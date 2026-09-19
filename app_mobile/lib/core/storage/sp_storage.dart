import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';

/// 本地轻量化存储管理类
///
/// 采用单例模式设计，负责客户端 Token、用户缓存及服务端地址的持久化
class SpStorage {
  static const String _keyToken = 'auth_token';
  static const String _keyUser = 'cached_user_info';
  static const String _keyBaseUrl = 'server_base_url';

  static SpStorage? _instance;
  static SharedPreferences? _prefs;

  SpStorage._();

  static Future<SpStorage> getInstance() async {
    if (_instance == null) {
      _instance = SpStorage._();
      _prefs = await SharedPreferences.getInstance();
    }
    return _instance!;
  }

  /// 获取服务器基准地址
  String getBaseUrl() {
    return _prefs?.getString(_keyBaseUrl) ?? ApiConstants.defaultBaseUrl;
  }

  /// 更新服务器基准地址
  Future<bool> setBaseUrl(String url) async {
    // 自动去除末尾可能多余的斜杠
    final cleanUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    return await _prefs?.setString(_keyBaseUrl, cleanUrl) ?? false;
  }

  /// 获取当前已存储的鉴权 Token
  String? getToken() {
    return _prefs?.getString(_keyToken);
  }

  /// 保存鉴权 Token
  Future<bool> setToken(String token) async {
    return await _prefs?.setString(_keyToken, token) ?? false;
  }

  /// 获取缓存的用户信息 JSON
  Map<String, dynamic>? getUserInfo() {
    final rawJson = _prefs?.getString(_keyUser);
    if (rawJson == null || rawJson.isEmpty) return null;
    try {
      return jsonDecode(rawJson) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  /// 保存用户信息 JSON
  Future<bool> setUserInfo(Map<String, dynamic> userInfo) async {
    return await _prefs?.setString(_keyUser, jsonEncode(userInfo)) ?? false;
  }

  /// 清除登录凭据（退出登录）
  Future<void> clearAuth() async {
    await _prefs?.remove(_keyToken);
    await _prefs?.remove(_keyUser);
  }
}
