import 'package:flutter_test/flutter_test.dart';
import 'package:bbs_go_mobile/models/api_response.dart';
import 'package:bbs_go_mobile/models/user_model.dart';
import 'package:bbs_go_mobile/models/topic_model.dart';
import 'package:bbs_go_mobile/models/category_model.dart';
import 'package:bbs_go_mobile/core/utils/date_util.dart';

void main() {
  group('数据实体解析测试', () {
    test('ApiResponse 正确解析后端 JSON 信封', () {
      final json = {
        'code': 0,
        'message': 'success',
        'success': true,
        'data': {'id': '101', 'name': 'Go 语言版块'}
      };

      final resp = ApiResponse.fromJson(
        json,
        (data) => CategoryModel.fromJson(data as Map<String, dynamic>),
      );

      expect(resp.isSuccess, true);
      expect(resp.code, 0);
      expect(resp.data?.name, 'Go 语言版块');
    });

    test('UserModel 字段与头像解析正常', () {
      final userJson = {
        'id': 'u1001',
        'nickname': 'ASWJ',
        'score': 500,
        'level': 3,
        'levelTitle': '初窥门径',
        'avatar': '/res/avatars/user1.png',
      };

      final user = UserModel.fromJson(userJson);
      expect(user.id, 'u1001');
      expect(user.nickname, 'ASWJ');
      expect(user.score, 500);
      expect(user.levelTitle, '初窥门径');
      expect(user.getAvatarUrl('http://10.0.2.2:8082'),
          'http://10.0.2.2:8082/res/avatars/user1.png');
    });

    test('TopicModel 正常映射帖子信息', () {
      final topicJson = {
        'id': 't999',
        'title': 'Go 语言高并发实战教程',
        'summary': '深入解析 Goroutine 与 Channel',
        'viewCount': 1024,
        'likeCount': 66,
        'liked': true,
        'sticky': true,
        'createTime': 1718899200,
      };

      final topic = TopicModel.fromJson(topicJson);
      expect(topic.id, 't999');
      expect(topic.title, 'Go 语言高并发实战教程');
      expect(topic.viewCount, 1024);
      expect(topic.likeCount, 66);
      expect(topic.liked, true);
      expect(topic.sticky, true);
    });

    test('DateUtil 人性化相对时间计算', () {
      final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      expect(DateUtil.formatRelativeTime(nowSec - 10), '刚刚');
      expect(DateUtil.formatRelativeTime(nowSec - 120), '2分钟前');
      expect(DateUtil.formatRelativeTime(nowSec - 7200), '2小时前');
    });
  });
}
