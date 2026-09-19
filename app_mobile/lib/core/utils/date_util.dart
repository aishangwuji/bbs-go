import 'package:intl/intl.dart';

/// 时间格式化与相对时间计算工具
class DateUtil {
  /// 将时间戳（支持秒级或毫秒级）格式化为相对时间（刚刚、X分钟前、X小时前等）
  static String formatRelativeTime(dynamic timestamp) {
    if (timestamp == null) return '';

    int ms = 0;
    if (timestamp is int) {
      // 若时间戳长度是 10 位说明是秒，需乘以 1000 转为毫秒
      if (timestamp < 10000000000) {
        ms = timestamp * 1000;
      } else {
        ms = timestamp;
      }
    } else if (timestamp is String) {
      final parsed = int.tryParse(timestamp);
      if (parsed != null) {
        return formatRelativeTime(parsed);
      }
      return timestamp;
    } else {
      return '';
    }

    final date = DateTime.fromMillisecondsSinceEpoch(ms);
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inSeconds < 60) {
      return '刚刚';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}分钟前';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}小时前';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}天前';
    } else if (date.year == now.year) {
      return DateFormat('MM-dd HH:mm').format(date);
    } else {
      return DateFormat('yyyy-MM-dd').format(date);
    }
  }

  /// 格式化为完整年月日格式
  static String formatFullDate(dynamic timestamp) {
    if (timestamp == null) return '';
    int ms = 0;
    if (timestamp is int) {
      ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    } else {
      return '';
    }
    final date = DateTime.fromMillisecondsSinceEpoch(ms);
    return DateFormat('yyyy-MM-dd HH:mm').format(date);
  }
}
