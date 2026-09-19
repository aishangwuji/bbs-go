/// 服务端统一下发的响应信封（Envelope）
///
/// 对应 Go 后端 ginx.buildJSONResult 生成的数据载荷
class ApiResponse<T> {
  final int code;
  final String? message;
  final T? data;
  final bool success;

  ApiResponse({
    required this.code,
    this.message,
    this.data,
    required this.success,
  });

  /// 是否请求成功 (Go 后端通常在 code == 0 且 success == true 时判定成功)
  bool get isSuccess => code == 0;

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic json)? fromJsonT,
  ) {
    return ApiResponse<T>(
      code: json['code'] as int? ?? (json['success'] == true ? 0 : -1),
      message: json['message'] as String?,
      success: json['success'] as bool? ?? (json['code'] == 0),
      data: json['data'] != null && fromJsonT != null
          ? fromJsonT(json['data'])
          : (json['data'] as T?),
    );
  }
}

/// 游标/流式列表数据载荷
///
/// 对应 Go 后端 ginx.CursorData(results, cursor, hasMore)
class CursorResult<T> {
  final List<T> results;
  final String? cursor;
  final bool hasMore;

  CursorResult({
    required this.results,
    this.cursor,
    required this.hasMore,
  });

  factory CursorResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) itemFactory,
  ) {
    final rawList = json['results'] as List<dynamic>? ?? [];
    final items = rawList
        .whereType<Map<String, dynamic>>()
        .map((item) => itemFactory(item))
        .toList();

    return CursorResult<T>(
      results: items,
      cursor: json['cursor']?.toString(),
      hasMore: json['hasMore'] as bool? ?? false,
    );
  }
}
