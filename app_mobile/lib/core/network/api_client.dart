import 'package:dio/dio.dart';
import 'package:fluttertoast/fluttertoast.dart';
import '../storage/sp_storage.dart';
import '../../models/api_response.dart';

/// 移动端 HTTP 网络引擎
///
/// 封装 Dio，统一处理：
/// 1. 动态 BaseURL（方便在模拟器、真机局域网与公网间无缝切换）
/// 2. 鉴权拦截器（基于 Go 后端 user_token_service 注入 Bearer Token）
/// 3. 全局异常捕捉与轻量级 Toast 提示
class ApiClient {
  static ApiClient? _instance;
  late Dio _dio;

  ApiClient._() {
    _dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ),
    );

    // 安装拦截器
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final storage = await SpStorage.getInstance();

          // 动态更新 BaseUrl
          options.baseUrl = storage.getBaseUrl();

          // 注入 Token（对齐 Go 后端 Authorization: Bearer <token> 与 X-User-Token）
          final token = storage.getToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
            options.headers['X-User-Token'] = token;
          }

          return handler.next(options);
        },
        onResponse: (response, handler) {
          // 若后端返回的 HTTP 状态码正常，但业务状态码标识错误，统一处理
          if (response.data is Map<String, dynamic>) {
            final code = response.data['code'];
            final message = response.data['message'];
            if (code != null && code != 0 && message != null) {
              Fluttertoast.showToast(msg: message.toString());
            }
          }
          return handler.next(response);
        },
        onError: (DioException e, handler) {
          String errorMsg = '网络连接异常，请检查网络或后端服务';
          if (e.type == DioExceptionType.connectionTimeout ||
              e.type == DioExceptionType.receiveTimeout) {
            errorMsg = '网络请求超时，请稍后重试';
          } else if (e.response != null) {
            if (e.response?.data is Map<String, dynamic>) {
              errorMsg = e.response?.data['message'] ?? '服务返回异常(${e.response?.statusCode})';
            } else {
              errorMsg = '服务响应异常(${e.response?.statusCode})';
            }
          }
          Fluttertoast.showToast(msg: errorMsg);
          return handler.next(e);
        },
      ),
    );
  }

  static ApiClient get instance {
    _instance ??= ApiClient._();
    return _instance!;
  }

  Dio get dio => _dio;

  /// 通用 GET 请求封装
  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    T Function(dynamic data)? fromJsonT,
  }) async {
    try {
      final response = await _dio.get(
        path,
        queryParameters: queryParameters,
      );
      if (response.data is Map<String, dynamic>) {
        return ApiResponse<T>.fromJson(response.data, fromJsonT);
      }
      return ApiResponse<T>(code: -1, success: false, message: '响应格式非 JSON');
    } on DioException catch (e) {
      return ApiResponse<T>(
        code: e.response?.statusCode ?? -1,
        success: false,
        message: e.message ?? '网络异常',
      );
    } catch (e) {
      return ApiResponse<T>(code: -1, success: false, message: e.toString());
    }
  }

  /// 通用 POST 请求封装
  Future<ApiResponse<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    T Function(dynamic data)? fromJsonT,
  }) async {
    try {
      final response = await _dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
      );
      if (response.data is Map<String, dynamic>) {
        return ApiResponse<T>.fromJson(response.data, fromJsonT);
      }
      return ApiResponse<T>(code: -1, success: false, message: '响应格式非 JSON');
    } on DioException catch (e) {
      return ApiResponse<T>(
        code: e.response?.statusCode ?? -1,
        success: false,
        message: e.message ?? '网络异常',
      );
    } catch (e) {
      return ApiResponse<T>(code: -1, success: false, message: e.toString());
    }
  }
}
